const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow
let ytWindow

const DATA_PATH = path.join(__dirname, 'data.json')

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadFile('index.html')
}

app.whenReady().then(createWindow)

ipcMain.handle('debug-log', (_, payload) => {
  const message = payload?.message ?? 'debug'
  const details = payload?.details
  if (details !== undefined) {
    console.log(`[renderer] ${message}`, details)
  } else {
    console.log(`[renderer] ${message}`)
  }
  return true
})

// 🔥 Open link in separate window (can be controlled)
ipcMain.handle('open-link', async (_, url) => {
  console.log('[main] open-link called', url)
  if (!ytWindow) {
    ytWindow = new BrowserWindow({
      width: 1200,
      height: 800
    })

    ytWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
      console.log(`[yt console] level=${level} line=${line} source=${sourceId} message=${message}`)
    })

    ytWindow.on('closed', () => {
      ytWindow = null
    })
  }

  try {
    await ytWindow.loadURL(url)
    console.log('[main] open-link loaded successfully')
    return { status: 'ok', message: 'Loaded' }
  } catch (err) {
    console.log('[main] open-link failed', err)
    return { status: 'error', message: err.message }
  }
})

// load & save data
ipcMain.handle('load-data', () => {
  if (!fs.existsSync(DATA_PATH)) return []
  return JSON.parse(fs.readFileSync(DATA_PATH))
})

ipcMain.handle('save-data', (_, data) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
})

// 🔍 Detect subscribe status
ipcMain.handle('check-subscribe', async () => {
  if (!ytWindow) return { status: 'error', message: 'YouTube window not open' }

  try {
    console.log('[main] check-subscribe started')
    const result = await ytWindow.webContents.executeJavaScript(`
      (async () => {
        const collectElements = (root, output, limit = 2000) => {
          if (!root || output.length >= limit) return

          const walk = (node) => {
            if (!node || output.length >= limit) return
            if (node.nodeType === Node.ELEMENT_NODE) {
              output.push(node)
              if (node.shadowRoot) {
                collectElements(node.shadowRoot, output, limit)
              }
            }
            const children = node.children || []
            for (const child of children) {
              walk(child)
              if (output.length >= limit) return
            }
          }

          walk(root)
        }

        const isSubscribeLike = (el) => {
          if (!el) return false
          const text = (el.textContent || '').trim().toLowerCase()
          const label = (el.getAttribute && (el.getAttribute('aria-label') || '')).trim().toLowerCase()
          const pressed = el.getAttribute && el.getAttribute('aria-pressed')
          const className = typeof el.className === 'string' ? el.className.toLowerCase() : ''

          if (className.includes('yt-icon-button')) return false
          if (!text && !label) return false

          return pressed === 'true' ||
            text === 'subscribe' ||
            text === 'subscribed' ||
            text === 'unsubscribe' ||
            label === 'subscribe' ||
            label === 'subscribed' ||
            label === 'unsubscribe' ||
            label.startsWith('subscribe to ') ||
            label.startsWith('unsubscribe from ')
        }

        const dumpElement = (el) => ({
          text: (el.textContent || '').trim().slice(0, 120),
          ariaLabel: (el.getAttribute && (el.getAttribute('aria-label') || '').trim()) || '',
          ariaPressed: el.getAttribute && el.getAttribute('aria-pressed'),
          tag: el.tagName,
          role: el.getAttribute && el.getAttribute('role'),
          className: typeof el.className === 'string' ? el.className : ''
        })

        const findSubscribeButton = () => {
          const nodes = []
          collectElements(document.body, nodes)
          const matched = nodes.find(isSubscribeLike)

          if (!matched) {
            return { found: null, dump: nodes.filter(el => {
              const text = (el.textContent || '').trim().toLowerCase()
              const label = (el.getAttribute && (el.getAttribute('aria-label') || '').trim().toLowerCase()) || ''
              return text.includes('subscribe') || label.includes('subscribe') || text.includes('subscriber') || label.includes('subscriber')
            }).slice(0, 30).map(dumpElement) }
          }

          const getClickable = (el) => {
            let curr = el
            while (curr && curr !== document.body && curr !== document) {
              if (curr.tagName === 'BUTTON' || curr.tagName === 'A' || (curr.getAttribute && curr.getAttribute('role') === 'button') || curr.tagName === 'YT-BUTTON-SHAPE') {
                return curr
              }
              if (curr.className && typeof curr.className === 'string' && curr.className.includes('yt-spec-button-shape-next')) {
                return curr
              }
              curr = curr.parentNode || curr.host
            }
            return el
          }

          const clickable = getClickable(matched)
          return { found: clickable, matched: matched, dump: [dumpElement(clickable), dumpElement(matched)] }
        }

        const isSubscribedButton = (btn) => {
          if (!btn) return false
          const text = (btn.textContent || '').trim().toLowerCase()
          const label = (btn.getAttribute && btn.getAttribute('aria-label') || '').trim().toLowerCase()
          const pressed = btn.getAttribute && btn.getAttribute('aria-pressed')
          const className = typeof btn.className === 'string' ? btn.className.toLowerCase() : ''

          if (className.includes('yt-icon-button')) return false
          if (!text && !label) return false

          return pressed === 'true' || text === 'subscribed' || text === 'unsubscribe' || label === 'subscribed' || label === 'unsubscribe' || label.startsWith('unsubscribe from ')
        }

        // Tunggu page load
        await new Promise(r => setTimeout(r, 2000))
        
        // Cari subscribe button
        const subBtnResult = findSubscribeButton()
        if (!subBtnResult.found) {
          return { subscribed: 'unknown', message: 'Button not found', dump: subBtnResult.dump }
        }
        const subBtn = subBtnResult.found
        
        // Check if already subscribed (button text changed)
        const isSubscribed = isSubscribedButton(subBtn)
        console.log('[yt debug] found button', dumpElement(subBtn))
        
        return {
          subscribed: isSubscribed ? 'yes' : 'no',
          buttonText: subBtn.textContent,
          message: isSubscribed ? 'Already subscribed' : 'Not subscribed yet',
          dump: [dumpElement(subBtn)]
        }
      })()
    `)
    
    if (result?.dump) {
      console.log('[main] check-subscribe dump', JSON.stringify(result.dump, null, 2))
    }
    console.log('[main] check-subscribe result', result)
    return result
  } catch (err) {
    console.log('[main] check-subscribe failed', err)
    return { status: 'error', message: err.message }
  }
})

// 🤖 Humanoid auto-clicker
ipcMain.handle('auto-subscribe', async () => {
  if (!ytWindow) return { status: 'error', message: 'YouTube window not open' }

  try {
    console.log('[main] auto-subscribe started')
    const result = await ytWindow.webContents.executeJavaScript(`
      (async () => {
        const collectElements = (root, output, limit = 2000) => {
          if (!root || output.length >= limit) return

          const walk = (node) => {
            if (!node || output.length >= limit) return
            if (node.nodeType === Node.ELEMENT_NODE) {
              output.push(node)
              if (node.shadowRoot) {
                collectElements(node.shadowRoot, output, limit)
              }
            }
            const children = node.children || []
            for (const child of children) {
              walk(child)
              if (output.length >= limit) return
            }
          }

          walk(root)
        }

        const isSubscribeLike = (el) => {
          if (!el) return false
          const text = (el.textContent || '').trim().toLowerCase()
          const label = (el.getAttribute && (el.getAttribute('aria-label') || '')).trim().toLowerCase()
          const pressed = el.getAttribute && el.getAttribute('aria-pressed')
          const className = typeof el.className === 'string' ? el.className.toLowerCase() : ''

          if (className.includes('yt-icon-button')) return false
          if (!text && !label) return false

          return pressed === 'true' ||
            text === 'subscribe' ||
            text === 'subscribed' ||
            text === 'unsubscribe' ||
            label === 'subscribe' ||
            label === 'subscribed' ||
            label === 'unsubscribe' ||
            label.startsWith('subscribe to ')
        }

        const dumpElement = (el) => ({
          text: (el.textContent || '').trim().slice(0, 120),
          ariaLabel: (el.getAttribute && (el.getAttribute('aria-label') || '').trim()) || '',
          ariaPressed: el.getAttribute && el.getAttribute('aria-pressed'),
          tag: el.tagName,
          role: el.getAttribute && el.getAttribute('role'),
          className: typeof el.className === 'string' ? el.className : ''
        })

        const findSubscribeButton = () => {
          const nodes = []
          collectElements(document.body, nodes)
          const matched = nodes.find(isSubscribeLike)

          if (!matched) {
            return { found: null, dump: nodes.filter(el => {
              const text = (el.textContent || '').trim().toLowerCase()
              const label = (el.getAttribute && (el.getAttribute('aria-label') || '').trim().toLowerCase()) || ''
              return text.includes('subscribe') || label.includes('subscribe') || text.includes('subscriber') || label.includes('subscriber')
            }).slice(0, 30).map(dumpElement) }
          }

          const getClickable = (el) => {
            let curr = el
            while (curr && curr !== document.body && curr !== document) {
              if (curr.tagName === 'BUTTON' || curr.tagName === 'A' || (curr.getAttribute && curr.getAttribute('role') === 'button') || curr.tagName === 'YT-BUTTON-SHAPE') {
                return curr
              }
              if (curr.className && typeof curr.className === 'string' && curr.className.includes('yt-spec-button-shape-next')) {
                return curr
              }
              curr = curr.parentNode || curr.host
            }
            return el
          }

          const clickable = getClickable(matched)
          return { found: clickable, matched: matched, dump: [dumpElement(clickable), dumpElement(matched)] }
        }

        const isSubscribedButton = (btn) => {
          if (!btn) return false
          const text = (btn.textContent || '').trim().toLowerCase()
          const label = (btn.getAttribute && btn.getAttribute('aria-label') || '').trim().toLowerCase()
          const pressed = btn.getAttribute && btn.getAttribute('aria-pressed')
          const className = typeof btn.className === 'string' ? btn.className.toLowerCase() : ''

          if (className.includes('yt-icon-button')) return false
          if (!text && !label) return false

          return pressed === 'true' || text === 'subscribed' || text === 'unsubscribe' || label === 'subscribed' || label === 'unsubscribe' || label.startsWith('unsubscribe from ')
        }

        // Wait for page load a bit (human slower)
        await new Promise(r => setTimeout(r, 2000))

        // Find subscribe button
        const subBtnResult = findSubscribeButton()
        if (subBtnResult && subBtnResult.found === null) {
          console.log('[yt debug] subscribe button candidates', JSON.stringify(subBtnResult.dump))
        }
        const subBtn = subBtnResult && subBtnResult.found ? subBtnResult.found : null
        if (!subBtn) {
          return { status: 'not_found', message: 'Subscribe button not found' }
        }

        // Check if already subscribed
        const alreadySubscribed = isSubscribedButton(subBtn)
        if (alreadySubscribed) {
          return { status: 'already_subscribed', message: 'Already subscribed' }
        }

        // Compute button center
        const rect = subBtn.getBoundingClientRect()
        // Ensure element is visible
        if (rect.width === 0 || rect.height === 0) {
            // Try scrolling to it
            subBtn.scrollIntoView({ behavior: 'smooth', block: 'center' })
            await new Promise(r => setTimeout(r, 1000))
            const newRect = subBtn.getBoundingClientRect()
            return {
              status: 'ready',
              rect: { left: newRect.left, top: newRect.top, width: newRect.width, height: newRect.height }
            }
        }

        return {
          status: 'ready',
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        }
      })()
    `)

    if (result.status === 'not_found') return { success: false, message: result.message }
    if (result.status === 'already_subscribed') return { success: false, message: result.message }

    if (result.status === 'ready' && result.rect) {
        const { left, top, width, height } = result.rect
        const btnX = left + width / 2 + (Math.random() * 10 - 5)
        const btnY = top + height / 2 + (Math.random() * 6 - 3)

        // Human-like move function using sendInputEvent
        const moveMouseHardware = async (sx, sy, ex, ey, duration = 800) => {
            const steps = Math.max(12, Math.floor(duration / 12))
            for (let i = 0; i < steps; i++) {
                const progress = (i + 1) / steps
                const ease = progress < 0.5 ? 2*progress*progress : -1 + (4 - 2*progress)*progress
                
                const mx = sx + (ex - sx) * ease + (Math.random() * 4 - 2)
                const my = sy + (ey - sy) * ease + (Math.random() * 4 - 2)

                ytWindow.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(mx), y: Math.round(my) })
                
                const wait = Math.max(8, Math.round((duration / steps) * (0.8 + Math.random() * 0.4)))
                await new Promise(r => setTimeout(r, wait))
            }
        }

        const startX = Math.random() * 800
        const startY = Math.random() * 600

        await moveMouseHardware(startX, startY, btnX, btnY, 600 + Math.random() * 300)
        await new Promise(r => setTimeout(r, 200 + Math.random() * 500))

        // Click!
        ytWindow.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(btnX), y: Math.round(btnY), button: 'left', clickCount: 1 })
        await new Promise(r => setTimeout(r, 50 + Math.random() * 150))
        ytWindow.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(btnX), y: Math.round(btnY), button: 'left', clickCount: 1 })

        // Wait for result
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000))

        // Check result
        const checkResult = await ytWindow.webContents.executeJavaScript(`
            (async () => {
                const isSubscribedButton = (btn) => {
                    if (!btn) return false
                    const text = (btn.textContent || '').trim().toLowerCase()
                    const label = (btn.getAttribute && btn.getAttribute('aria-label') || '').trim().toLowerCase()
                    const pressed = btn.getAttribute && btn.getAttribute('aria-pressed')
                    
                    if (typeof btn.className === 'string' && btn.className.toLowerCase().includes('yt-icon-button')) return false
                    if (!text && !label) return false

                    return pressed === 'true' || text === 'subscribed' || text === 'unsubscribe' || label === 'subscribed' || label === 'unsubscribe' || label.startsWith('unsubscribe from ')
                }

                // We try to find the button again using the same logic to check if it's subscribed
                const walk = (node, output) => {
                    if (!node || output.length >= 2000) return
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        output.push(node)
                        if (node.shadowRoot) walk(node.shadowRoot, output)
                    }
                    const children = node.children || []
                    for (const child of children) {
                        walk(child, output)
                        if (output.length >= 2000) return
                    }
                }
                const nodes = []
                walk(document.body, nodes)

                const isSubscribeLike = (el) => {
                    if (!el) return false
                    const text = (el.textContent || '').trim().toLowerCase()
                    const label = (el.getAttribute && (el.getAttribute('aria-label') || '')).trim().toLowerCase()
                    const pressed = el.getAttribute && el.getAttribute('aria-pressed')
                    const className = typeof el.className === 'string' ? el.className.toLowerCase() : ''

                    if (className.includes('yt-icon-button')) return false
                    if (!text && !label) return false

                    return pressed === 'true' ||
                        text === 'subscribe' ||
                        text === 'subscribed' ||
                        text === 'unsubscribe' ||
                        label === 'subscribe' ||
                        label === 'subscribed' ||
                        label === 'unsubscribe' ||
                        label.startsWith('subscribe to ') ||
                        label.startsWith('unsubscribe from ')
                }

                const matched = nodes.find(isSubscribeLike)
                const getClickable = (el) => {
                    let curr = el
                    while (curr && curr !== document.body && curr !== document) {
                        if (curr.tagName === 'BUTTON' || curr.tagName === 'A' || (curr.getAttribute && curr.getAttribute('role') === 'button') || curr.tagName === 'YT-BUTTON-SHAPE') {
                            return curr
                        }
                        if (curr.className && typeof curr.className === 'string' && curr.className.includes('yt-spec-button-shape-next')) return curr
                        curr = curr.parentNode || curr.host
                    }
                    return el
                }
                
                const btn = matched ? getClickable(matched) : null
                const isNowSubscribed = isSubscribedButton(btn)
                return { isNowSubscribed, btnFound: !!btn }
            })()
        `)

        return { success: checkResult.isNowSubscribed, message: checkResult.isNowSubscribed ? 'Successfully subscribed! ✓' : 'Subscription may have failed' }
    }

    if (result?.dump) {
      console.log('[main] auto-subscribe dump', result.dump)
    }
    console.log('[main] auto-subscribe result', result)
    return result
  } catch (err) {
    console.log('[main] auto-subscribe failed', err)
    return { success: false, message: 'Error: ' + err.message }
  }
})