const { app, BrowserWindow, ipcMain, shell } = require('electron')
const fs = require('fs')
const path = require('path')

const DATA_PATH = path.join(__dirname, 'data.json')

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(createWindow)

// buka link di browser
ipcMain.handle('open-link', (_, url) => {
  shell.openExternal(url)
})

// load data
ipcMain.handle('load-data', () => {
  if (!fs.existsSync(DATA_PATH)) return []
  return JSON.parse(fs.readFileSync(DATA_PATH))
})

// simpan data
ipcMain.handle('save-data', (_, data) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
})