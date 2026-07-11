import App from './App';
import AboutWindow from '@renderer/AboutWindow';
import AppSettingsWindow from '@renderer/AppSettingsWindow';
import HistoryWindow from '@renderer/HistoryWindow';
import { bootstrapWindow } from '@renderer/bootstrapWindow';

const pathname = window.location.pathname;
const RootComponent = pathname.endsWith('/settings.html')
  ? AppSettingsWindow
  : pathname.endsWith('/history.html')
    ? HistoryWindow
    : pathname.endsWith('/about.html')
      ? AboutWindow
      : App;

bootstrapWindow(RootComponent);
