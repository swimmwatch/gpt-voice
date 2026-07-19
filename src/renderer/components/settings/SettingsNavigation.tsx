import { Globe2, Keyboard, Network, Settings2, Sparkles, type LucideIcon } from 'lucide-react';
import type { JSX } from 'react';
import { TabsList, TabsTrigger } from '@renderer/components/ui/tabs';
import type { TranslationFunction } from '@renderer/components/settings/types';
import { APP_SETTINGS_SECTION_IDS, type AppSettingsSectionId } from '@shared/appSettings';

export const SETTINGS_SECTION_IDS = APP_SETTINGS_SECTION_IDS;
export type SettingsSectionId = AppSettingsSectionId;

interface SettingsNavigationItem {
  icon: LucideIcon;
  id: SettingsSectionId;
  labelKey: string;
}

const SETTINGS_NAVIGATION_ITEMS: readonly SettingsNavigationItem[] = [
  { icon: Settings2, id: 'system', labelKey: 'settingsSection.system' },
  { icon: Keyboard, id: 'shortcuts', labelKey: 'settingsSection.shortcuts' },
  { icon: Sparkles, id: 'prettify', labelKey: 'settingsSection.prettify' },
  { icon: Globe2, id: 'browser', labelKey: 'settingsSection.browser' },
  { icon: Network, id: 'network', labelKey: 'settingsSection.network' },
];

interface SettingsNavigationProps {
  t: TranslationFunction;
}

function SettingsNavigation({ t }: SettingsNavigationProps): JSX.Element {
  return (
    <TabsList aria-label={t('appSettings.title')} className="w-52 shrink-0 max-[639px]:w-12 max-[639px]:!items-center">
      {SETTINGS_NAVIGATION_ITEMS.map(({ icon: Icon, id, labelKey }) => {
        const label = t(labelKey);

        return (
          <TabsTrigger
            aria-label={label}
            className="max-[639px]:size-9 max-[639px]:!justify-center max-[639px]:px-0"
            key={id}
            value={id}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="whitespace-nowrap max-[639px]:sr-only">{label}</span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

export default SettingsNavigation;
