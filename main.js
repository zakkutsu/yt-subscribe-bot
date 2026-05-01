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

// 🔥 Open link in separate window (can be controlled)
ipcMain.handle('open-link', async (_, url) => {
  if (!ytWindow) {
    ytWindow = new BrowserWindow({
      width: 1200,
      height: 800
    })

    ytWindow.on('closed', () => {
      ytWindow = null
    })
  }

  try {
    await ytWindow.loadURL(url)
    return { status: 'ok', message: 'Loaded' }
  } catch (err) {
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
    const result = await ytWindow.webContents.executeJavaScript(`
      (async () => {
        const getSubscribeButton = () => {
          const buttons = Array.from(document.querySelectorAll('button'))
          return document.querySelector('[aria-label*="Subscribe" i], [aria-label*="Subscribed" i], [aria-label*="Unsubscribe" i]') ||
            buttons.find(btn => {
              const text = (btn.textContent || '').toLowerCase()
              const label = (btn.getAttribute('aria-label') || '').toLowerCase()
              return text.includes('subscribe') || text.includes('subscribed') || text.includes('unsubscribe') ||
                label.includes('subscribe') || label.includes('subscribed') || label.includes('unsubscribe')
            })
        }

        const isSubscribedButton = (btn) => {
          if (!btn) return false
          const text = (btn.textContent || '').toLowerCase()
          const label = (btn.getAttribute('aria-label') || '').toLowerCase()
          const pressed = btn.getAttribute('aria-pressed')
          return pressed === 'true' || text.includes('subscribed') || text.includes('unsubscribe') || label.includes('unsubscribe') || label.includes('subscribed')
        }

        // Tunggu page load
        await new Promise(r => setTimeout(r, 2000))
        
        // Cari subscribe button
        const subBtn = getSubscribeButton()
        
        if (!subBtn) {
          return { subscribed: 'unknown', message: 'Button not found' }
        }
        
        // Check if already subscribed (button text changed)
        const isSubscribed = isSubscribedButton(subBtn)
        
        return {
          subscribed: isSubscribed ? 'yes' : 'no',
          buttonText: subBtn.textContent,
          message: isSubscribed ? 'Already subscribed' : 'Not subscribed yet'
        }
      })()
    `)
    
    return result
  } catch (err) {
    return { status: 'error', message: err.message }
  }
})

// 🤖 Humanoid auto-clicker
ipcMain.handle('auto-subscribe', async () => {
  if (!ytWindow) return { status: 'error', message: 'YouTube window not open' }

  try {
    const result = await ytWindow.webContents.executeJavaScript(`
      (async () => {
        const getSubscribeButton = () => {
          const buttons = Array.from(document.querySelectorAll('button'))
          return document.querySelector('[aria-label*="Subscribe" i], [aria-label*="Subscribed" i], [aria-label*="Unsubscribe" i]') ||
            buttons.find(btn => {
              const text = (btn.textContent || '').toLowerCase()
              const label = (btn.getAttribute('aria-label') || '').toLowerCase()
              return text.includes('subscribe') || text.includes('subscribed') || text.includes('unsubscribe') ||
                label.includes('subscribe') || label.includes('subscribed') || label.includes('unsubscribe')
            })
        }

        const isSubscribedButton = (btn) => {
          if (!btn) return false
          const text = (btn.textContent || '').toLowerCase()
          const label = (btn.getAttribute('aria-label') || '').toLowerCase()
          const pressed = btn.getAttribute('aria-pressed')
          return pressed === 'true' || text.includes('subscribed') || text.includes('unsubscribe') || label.includes('unsubscribe') || label.includes('subscribed')
        }

        // Utilities
        const rand = (a, b) => Math.random() * (b - a) + a
        const gauss = (() => {
          // Box-Muller transform
          let spare = null
          return () => {
            if (spare !== null) { const val = spare; spare = null; return val }
            let u = 0, v = 0
            while (u === 0) u = Math.random()
            while (v === 0) v = Math.random()
            const mag = Math.sqrt(-2.0 * Math.log(u))
            spare = mag * Math.sin(2.0 * Math.PI * v)
            return mag * Math.cos(2.0 * Math.PI * v)
          }
        })()

        // Cubic bezier helpers
        const cubic = (t, p0, p1, p2, p3) => {
          const u = 1 - t
          return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3
        }
        const pointOnCubic = (t, sx, sy, c1x, c1y, c2x, c2y, ex, ey) => ({
          x: cubic(t, sx, c1x, c2x, ex),
          y: cubic(t, sy, c1y, c2y, ey)
        })
        const generateControlPoints = (sx, sy, ex, ey) => {
          const dx = ex - sx, dy = ey - sy
          const dist = Math.hypot(dx, dy) || 1
          const angle = Math.atan2(dy, dx)
          const spread = Math.min(0.8, dist / 300)
          const c1angle = angle + rand(-0.8, 0.8)
          const c2angle = angle + rand(-0.8, 0.8)
          const c1dist = dist * rand(0.15, 0.6)
          const c2dist = dist * rand(0.15, 0.6)
          return {
            c1x: sx + Math.cos(c1angle) * c1dist,
            c1y: sy + Math.sin(c1angle) * c1dist,
            c2x: sx + Math.cos(c2angle) * (dist - c2dist),
            c2y: sy + Math.sin(c2angle) * (dist - c2dist)
          }
        }

        // Human-like move function using randomized cubic bezier path,
        // variable speed profile, micro-jitter, occasional overshoot/correction.
        const moveMouse = async (sx, sy, ex, ey, duration = 800) => {
          const cp = generateControlPoints(sx, sy, ex, ey)
          const steps = Math.max(12, Math.floor(duration / 12))

          for (let i = 0; i < steps; i++) {
            const progress = (i + 1) / steps
            // speed profile: easeInOut combined with slight randomness
            const ease = progress < 0.5 ? 2*progress*progress : -1 + (4 - 2*progress)*progress
            const jitter = Math.sin(progress * Math.PI) * rand(-0.08, 0.08)
            const t = Math.max(0, Math.min(1, ease + jitter))

            const p = pointOnCubic(t, sx, sy, cp.c1x, cp.c1y, cp.c2x, cp.c2y, ex, ey)
            // micro-jitter and small Gaussian noise
            const mx = p.x + gauss() * rand(0.2, 2.2)
            const my = p.y + gauss() * rand(0.2, 2.2)

            const ev = new MouseEvent('mousemove', {
              bubbles: true,
              clientX: Math.round(mx),
              clientY: Math.round(my),
              screenX: Math.round(mx),
              screenY: Math.round(my)
            })
            document.elementFromPoint(Math.round(mx), Math.round(my))?.dispatchEvent(ev)

            // variable interval: faster in middle, slower at ends
            const base = duration / steps
            const speedFactor = 0.6 + 0.8 * Math.abs(0.5 - progress)
            const wait = Math.max(8, Math.round(base * (rand(0.6, 1.4)) * speedFactor))
            await new Promise(r => setTimeout(r, wait))
          }

          // small settling moves (tiny shakes)
          for (let k = 0; k < 3; k++) {
            const sxn = ex + gauss() * rand(0.2, 1.2)
            const syn = ey + gauss() * rand(0.2, 1.2)
            const ev2 = new MouseEvent('mousemove', { bubbles: true, clientX: Math.round(sxn), clientY: Math.round(syn) })
            document.elementFromPoint(Math.round(sxn), Math.round(syn))?.dispatchEvent(ev2)
            await new Promise(r => setTimeout(r, Math.round(rand(25, 120))))
          }
        }

        // Human-like random delay generator: mixture distribution for variability
        const randomDelay = (min, max) => {
          const r = Math.random()
          if (r < 0.55) return Math.round(min + Math.pow(Math.random(), 2) * (max - min))
          if (r < 0.9) return Math.round(min + Math.random() * (max - min))
          return Math.round(min + Math.pow(Math.random(), 0.5) * (max - min))
        }

        // Wait for page load a bit (human slower)
        await new Promise(r => setTimeout(r, randomDelay(1200, 2600)))

        // Find subscribe button
        const subBtn = getSubscribeButton()
        if (!subBtn) {
          return { success: false, message: 'Subscribe button not found' }
        }

        // Check if already subscribed
        const alreadySubscribed = isSubscribedButton(subBtn)
        if (alreadySubscribed) {
          return { success: false, message: 'Already subscribed' }
        }

        // Compute button center with small jitter
        const rect = subBtn.getBoundingClientRect()
        const btnX = rect.left + rect.width / 2 + rand(-10, 10)
        const btnY = rect.top + rect.height / 2 + rand(-6, 6)

        // Randomized start (some distance away)
        const startX = rand(0, window.innerWidth)
        const startY = rand(0, window.innerHeight)

        // Move mouse in human-like path
        await moveMouse(startX, startY, btnX, btnY, 600 + rand(-250, 900))

        // Pause before hover
        await new Promise(r => setTimeout(r, randomDelay(180, 900)))

        // Dispatch hover
        subBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: Math.round(btnX), clientY: Math.round(btnY) }))
        await new Promise(r => setTimeout(r, randomDelay(150, 900)))

        // Occasional hesitation
        if (Math.random() < 0.6) await new Promise(r => setTimeout(r, randomDelay(350, 1600)))

        // Press with realistic press duration
        const pressDuration = Math.round(rand(30, 260))
        subBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: Math.round(btnX), clientY: Math.round(btnY) }))
        await new Promise(r => setTimeout(r, pressDuration))
        subBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: Math.round(btnX), clientY: Math.round(btnY) }))
        subBtn.click()

        // Wait to observe result
        await new Promise(r => setTimeout(r, randomDelay(900, 2800)))

        const refreshedBtn = getSubscribeButton() || subBtn
        const isNowSubscribed = isSubscribedButton(refreshedBtn)
        return { success: isNowSubscribed, message: isNowSubscribed ? 'Successfully subscribed! ✓' : 'Subscription may have failed' }
      })()
    `)

    return result
  } catch (err) {
    return { success: false, message: 'Error: ' + err.message }
  }
})