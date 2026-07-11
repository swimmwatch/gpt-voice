import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { getAppIconPath } from './assets';
import type { AppInfo } from '@shared/appInfo';

export const APP_ID = 'com.swimmwatch.gptvoice';
export const APP_NAME = 'GPT-Voice';
export const APP_WEBSITE = 'https://github.com/swimmwatch/gpt-voice';
export const APP_COPYRIGHT = 'Copyright (c) 2026 Dmitry Vasiliev';
export const APP_LICENSE = 'PolyForm-Noncommercial-1.0.0';

export function createAppInfo(version: string): AppInfo {
  return {
    copyright: APP_COPYRIGHT,
    license: APP_LICENSE,
    name: APP_NAME,
    version,
  };
}

export function getAppInfo(): AppInfo {
  return createAppInfo(app.getVersion());
}

export function configureAppIdentity(): void {
  app.setName(APP_NAME);
  app.setAppUserModelId(APP_ID);
}

export function configureNativeAppMetadata(): void {
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    version: `Electron ${process.versions.electron}`,
    copyright: APP_COPYRIGHT,
    credits: 'Independent desktop voice transcription app powered by GPT web sessions.',
    authors: ['Dmitry Vasiliev'],
    website: APP_WEBSITE,
    iconPath: getAppIconPath(),
  });

  const helpSubmenu: MenuItemConstructorOptions[] = [
    {
      label: 'Project on GitHub',
      click: () => {
        void shell.openExternal(APP_WEBSITE);
      },
    },
  ];

  if (process.platform !== 'darwin') {
    helpSubmenu.push(
      { type: 'separator' },
      {
        label: `About ${APP_NAME}`,
        click: () => app.showAboutPanel(),
      },
    );
  }

  const appMenu: MenuItemConstructorOptions[] =
    process.platform === 'darwin'
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : [
          {
            label: 'File',
            submenu: [{ role: 'quit' }],
          },
        ];

  const template: MenuItemConstructorOptions[] = [
    ...appMenu,
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: helpSubmenu,
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
