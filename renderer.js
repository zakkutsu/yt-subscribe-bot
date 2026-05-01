let queue = []
let index = 0
let timer = null
let autoSubscribeEnabled = false
let smartModeEnabled = true
let subscribeStatus = {}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function updateSmartModeButton() {
  const button = document.getElementById('smart-mode-toggle')
  if (!button) return

  if (smartModeEnabled) {
    button.textContent = 'Smart Mode: ON'
    button.className = 'px-5 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 hover:border-emerald-300 transition-colors'
  } else {
    button.textContent = 'Smart Mode: OFF'
    button.className = 'px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-colors'
  }
}

function toggleSmartMode() {
  smartModeEnabled = !smartModeEnabled
  updateSmartModeButton()

  const status = document.getElementById('subscribe-status')
  if (status) {
    status.style.display = 'block'
    status.className = smartModeEnabled
      ? 'mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200'
      : 'mb-4 p-4 rounded-xl border bg-slate-50 border-slate-200'
    status.textContent = smartModeEnabled
      ? 'Smart mode enabled. START will auto-subscribe.'
      : 'Smart mode disabled. START will open links for manual subscribe.'
    status.style.color = smartModeEnabled ? '#065f46' : '#334155'
  }
}

async function init() {
  queue = await window.api.loadData()
  updateSmartModeButton()
  render()
}

function addLinks() {
  const raw = document.getElementById('link-input').value

  const links = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !queue.includes(l))

  if (links.length === 0) return

  queue.push(...links)

  window.api.saveData(queue)
  document.getElementById('link-input').value = ''
  render()
}

function render() {
  const list = document.getElementById('list')
  const emptyState = document.getElementById('empty-state')
  list.innerHTML = ''

  if (queue.length === 0) {
    emptyState.style.display = 'block'
    return
  }

  emptyState.style.display = 'none'

  queue.forEach((link, i) => {
    const isActive = i === index
    const subStatus = subscribeStatus[link]
    
    let statusBg = 'bg-slate-100 text-slate-600'
    let statusText = 'Pending'
    
    if (subStatus === 'subscribed') {
      statusBg = 'bg-emerald-100 text-emerald-700'
      statusText = '✓ Subscribed'
    } else if (subStatus === 'not-subscribed') {
      statusBg = 'bg-rose-100 text-rose-700'
      statusText = 'Not Subscribed'
    }
    
    const div = document.createElement('div')
    div.className = `p-4 flex items-center justify-between ${
      isActive ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-slate-50'
    } transition-colors`
    
    div.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          ${isActive ? '<span class="text-xl">▶</span>' : '<span class="text-slate-300 text-lg">•</span>'}
          <p class="text-sm font-medium text-slate-900 truncate">${link}</p>
        </div>
        <p class="text-xs text-slate-500 mt-1">Item ${i + 1} of ${queue.length}</p>
      </div>
      <span class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${statusBg}">${statusText}</span>
    `
    
    list.appendChild(div)
  })
}

async function autoSubscribe() {
  const status = document.getElementById('subscribe-status')
  if (!status) return

  if (autoSubscribeEnabled) {
    status.style.display = 'block'
    status.className = 'mb-4 p-4 rounded-xl border bg-amber-50 border-amber-200'
    status.textContent = '⚠️ Smart Auto Subscribe is already running.'
    status.style.color = '#92400e'
    return
  }

  if (queue.length === 0) {
    status.style.display = 'block'
    status.className = 'mb-4 p-4 rounded-xl border bg-slate-50 border-slate-200'
    status.textContent = 'No queue items to process.'
    status.style.color = '#475569'
    return
  }

  autoSubscribeEnabled = true
  status.style.display = 'block'
  status.className = 'mb-4 p-4 rounded-xl border bg-blue-50 border-blue-200'
  status.textContent = '🔍 Starting smart queue processing...'
  status.style.color = '#1e40af'

  try {
    for (let i = index; i < queue.length && autoSubscribeEnabled; i++) {
      index = i
      render()

      const link = queue[i]
      status.className = 'mb-4 p-4 rounded-xl border bg-blue-50 border-blue-200'
      status.textContent = `🔗 Opening ${i + 1} of ${queue.length}...`
      status.style.color = '#1e40af'

      const openResult = await window.api.openLink(link)
      if (openResult?.status === 'error') {
        subscribeStatus[link] = 'not-subscribed'
        status.className = 'mb-4 p-4 rounded-xl border bg-red-50 border-red-200'
        status.textContent = '❌ ' + openResult.message
        status.style.color = '#991b1b'
        render()
        continue
      }

      await sleep(3500)

      status.className = 'mb-4 p-4 rounded-xl border bg-blue-50 border-blue-200'
      status.textContent = `🔍 Checking subscribe status for item ${i + 1}...`
      status.style.color = '#1e40af'

      const checkResult = await window.api.checkSubscribe()
      if (checkResult.status === 'error') {
        subscribeStatus[link] = 'not-subscribed'
        status.className = 'mb-4 p-4 rounded-xl border bg-red-50 border-red-200'
        status.textContent = '❌ ' + checkResult.message
        status.style.color = '#991b1b'
        render()
        continue
      }

      if (checkResult.subscribed === 'yes') {
        subscribeStatus[link] = 'subscribed'
        status.className = 'mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200'
        status.textContent = `✅ Already subscribed for item ${i + 1}.`
        status.style.color = '#065f46'
        render()
        await sleep(randomDelay())
        continue
      }

      status.className = 'mb-4 p-4 rounded-xl border bg-violet-50 border-violet-200'
      status.textContent = `🤖 Auto-subscribing item ${i + 1}...`
      status.style.color = '#5b21b6'

      const result = await window.api.autoSubscribe()
      if (result.success) {
        subscribeStatus[link] = 'subscribed'
        status.className = 'mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200'
        status.textContent = `✅ ${result.message}`
        status.style.color = '#065f46'
      } else {
        subscribeStatus[link] = 'not-subscribed'
        status.className = 'mb-4 p-4 rounded-xl border bg-amber-50 border-amber-200'
        status.textContent = `⚠️ ${result.message}`
        status.style.color = '#92400e'
      }

      render()
      await sleep(randomDelay())
    }

    index = queue.length
    status.className = 'mb-4 p-4 rounded-xl border bg-slate-50 border-slate-200'
    status.textContent = 'Done processing queue.'
    status.style.color = '#334155'
    render()
  } catch (err) {
    status.className = 'mb-4 p-4 rounded-xl border bg-red-50 border-red-200'
    status.textContent = '❌ Error: ' + err.message
    status.style.color = '#991b1b'
  } finally {
    autoSubscribeEnabled = false
  }
}

async function openNext() {
  if (index >= queue.length) return

  const link = queue[index]

  await window.api.openLink(link)
  index++
  render()
}

function startQueue() {
  if (timer) clearTimeout(timer)

  if (smartModeEnabled) {
    autoSubscribe()
    return
  }

  runQueue()
}

async function runQueue() {
  if (index >= queue.length) return

  await openNext()

  const delay = randomDelay()

  timer = setTimeout(runQueue, delay)
}

function clearQueue() {
  queue = []
  index = 0

  window.api.saveData(queue)

  render()
}

function stopQueue() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }

  autoSubscribeEnabled = false
}

function restartQueue() {
  // reset dari awal
  index = 0

  // stop dulu kalau lagi jalan
  if (timer) {
    clearTimeout(timer)
    timer = null
  }

  // mulai lagi dari awal
  startQueue()
}

function resetIndex() {
  index = 0
  render()
}

function randomDelay() {
  return Math.floor(Math.random() * (7000 - 4000)) + 4000
}

init()