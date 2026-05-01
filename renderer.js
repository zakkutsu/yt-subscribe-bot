let queue = []
let index = 0
let timer = null
let autoSubscribeEnabled = false
let subscribeStatus = {}

async function init() {
  queue = await window.api.loadData()
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
        <p class="text-xs text-slate-500 mt-1">Item ${i + 1} dari ${queue.length}</p>
      </div>
      <span class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${statusBg}">${statusText}</span>
    `
    
    list.appendChild(div)
  })
}

async function autoSubscribe() {
  const status = document.getElementById('subscribe-status')
  if (!status) return

  status.style.display = 'block'
  status.className = 'mb-4 p-4 rounded-xl border bg-blue-50 border-blue-200'
  status.textContent = '🔍 Checking subscribe status...'
  status.style.color = '#1e40af'

  try {
    // Step 1: Cek status subscribe dulu
    const checkResult = await window.api.checkSubscribe()
    
    if (checkResult.status === 'error') {
      status.className = 'mb-4 p-4 rounded-xl border bg-red-50 border-red-200'
      status.textContent = '❌ ' + checkResult.message
      status.style.color = '#991b1b'
      return
    }

    // Step 2: Jika sudah subscribe, skip
    if (checkResult.subscribed === 'yes') {
      status.className = 'mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200'
      status.textContent = '✅ Sudah subscribe! Skip...'
      status.style.color = '#065f46'
      
      if (index < queue.length) {
        subscribeStatus[queue[index]] = 'subscribed'
      }
      render()
      return
    }

    // Step 3: Belum subscribe, proceed dengan auto subscribe
    status.className = 'mb-4 p-4 rounded-xl border bg-violet-50 border-violet-200'
    status.textContent = '🤖 Auto-subscribing... (humanoid mode)'
    status.style.color = '#5b21b6'

    const result = await window.api.autoSubscribe()
    
    if (result.success) {
      status.className = 'mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200'
      status.textContent = '✅ ' + result.message
      status.style.color = '#065f46'
      
      if (index < queue.length) {
        subscribeStatus[queue[index]] = 'subscribed'
      }
    } else {
      status.className = 'mb-4 p-4 rounded-xl border bg-amber-50 border-amber-200'
      status.textContent = '⚠️ ' + result.message
      status.style.color = '#92400e'
    }
    
    render()
  } catch (err) {
    status.className = 'mb-4 p-4 rounded-xl border bg-red-50 border-red-200'
    status.textContent = '❌ Error: ' + err.message
    status.style.color = '#991b1b'
  }
}

function openNext() {
  if (index >= queue.length) return

  const link = queue[index]

  window.api.openLink(link)

  index++
  render()
}

function startQueue() {
  if (timer) clearTimeout(timer)

  runQueue()
}

function runQueue() {
  if (index >= queue.length) return

  openNext()

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