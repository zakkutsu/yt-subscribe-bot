let queue = []
let index = 0
let timer = null

async function init() {
  queue = await window.api.loadData()
  render()
}

function addLinks() {
  const raw = document.getElementById('input').value

  const links = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !queue.includes(l))

  queue.push(...links)

  window.api.saveData(queue)

  render()
}

function render() {
  const list = document.getElementById('list')
  list.innerHTML = ''

  queue.forEach((link, i) => {
    const li = document.createElement('li')
    li.textContent = (i === index ? '👉 ' : '') + link
    list.appendChild(li)
  })
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