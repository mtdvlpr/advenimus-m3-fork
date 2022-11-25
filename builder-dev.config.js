const ICONS_DIR = 'build/icons/'

const windowsOS = {
  win: {
    icon: ICONS_DIR + 'icon.ico',
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    publish: ['github'],
  },

  nsis: {
    oneClick: false,
    differentialPackage: false,
  },
}

const linuxOS = {
  linux: {
    icon: ICONS_DIR,
    target: ['AppImage'],
    category: 'Utility',
    publish: ['github'],
  },
}

const macOS = {
  mac: {
    icon: ICONS_DIR + 'icon.icns',
    target: {
      target: 'dmg',
      arch: ['universal'],
    },
    publish: ['github'],
  },

  dmg: {
    writeUpdateInfo: false,
  },
}

module.exports = {
  productName: 'Meeting Media Manager',
  appId: 'sircharlo.meeting-media-manager',
  // eslint-disable-next-line no-template-curly-in-string
  artifactName: 'meeting-media-manager-${version}-${arch}.${ext}',
  buildDependenciesFromSource: true,
  directories: {
    output: 'build',
  },
  // default files: https://www.electron.build/configuration/contents
  files: [
    'package.json',
    {
      from: 'dist/main/',
      to: 'dist/main/',
    },
    {
      from: 'dist/renderer/',
      to: 'dist/renderer/',
    },
  ],
  extraResources: [
    {
      from: 'src/extraResources/',
      to: '',
    },
  ],
  ...windowsOS,
  ...linuxOS,
  ...macOS,
}