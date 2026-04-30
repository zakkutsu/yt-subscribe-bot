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

// 🔥 buka link di window sendiri (bisa dikontrol)
ipcMain.handle('open-link', (_, url) => {
  if (!ytWindow) {
    ytWindow = new BrowserWindow({
      width: 1200,
      height: 800
    })

    ytWindow.on('closed', () => {
      ytWindow = null
    })
  }

  ytWindow.loadURL(url)
})

// load & save tetap sama
ipcMain.handle('load-data', () => {
  if (!fs.existsSync(DATA_PATH)) return []
  return JSON.parse(fs.readFileSync(DATA_PATH))
})

ipcMain.handle('save-data', (_, data) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
})