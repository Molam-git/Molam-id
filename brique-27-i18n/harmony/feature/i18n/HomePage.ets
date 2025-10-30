// harmony/feature/i18n/HomePage.ets
// HarmonyOS multilingual home page

import { I18nManager } from './I18nManager';
import type { Language } from './I18nManager';

@Entry
@Component
struct HomePage {
  @State loading: boolean = true;
  @State currentLang: Language = 'en';
  @State showLanguagePicker: boolean = false;
  @State translations: Record<string, string> = {};

  private i18n: I18nManager = new I18nManager('http://localhost:3000');

  aboutToAppear() {
    this.initI18n();
  }

  async initI18n() {
    try {
      await this.i18n.init(getContext(this));
      this.currentLang = this.i18n.getCurrentLanguage();
      this.loading = false;
    } catch (err) {
      console.error('Failed to init i18n:', err);
      this.loading = false;
    }
  }

  async changeLanguage(newLang: Language) {
    this.loading = true;
    this.showLanguagePicker = false;
    try {
      await this.i18n.loadLanguage(newLang);
      this.currentLang = this.i18n.getCurrentLanguage();
    } catch (err) {
      console.error('Failed to change language:', err);
    }
    this.loading = false;
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  build() {
    Column() {
      if (this.loading) {
        Column() {
          LoadingProgress()
            .width(60)
            .height(60)
            .color('#10B981')

          Text('Loading...')
            .fontSize(16)
            .fontColor('#FFFFFF')
            .margin({ top: 16 })
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .linearGradient({
          angle: 180,
          colors: [[0x064E3B, 0.0], [0x047857, 1.0]]
        })
      } else {
        Scroll() {
          Column() {
            // Language Switcher
            Row() {
              Button(this.getLangLabel(this.currentLang) + ' ▼')
                .backgroundColor('rgba(255, 255, 255, 0.2)')
                .fontColor('#FFFFFF')
                .fontSize(14)
                .borderRadius(20)
                .border({ width: 1, color: 'rgba(255, 255, 255, 0.3)' })
                .onClick(() => {
                  this.showLanguagePicker = true;
                })
            }
            .width('100%')
            .justifyContent(FlexAlign.End)
            .padding(20)

            // Logo
            Column() {
              Row() {
                Text('M')
                  .fontSize(48)
                  .fontWeight(FontWeight.Bold)
                  .fontColor('#FFFFFF')
              }
              .width(96)
              .height(96)
              .backgroundColor('rgba(255, 255, 255, 0.2)')
              .borderRadius(28)
              .border({ width: 1, color: 'rgba(255, 255, 255, 0.3)' })
              .justifyContent(FlexAlign.Center)
            }
            .margin({ top: 32, bottom: 32 })

            // Welcome Title
            Column() {
              Text(this.t('home.welcome'))
                .fontSize(36)
                .fontWeight(FontWeight.Bold)
                .fontColor('#FFFFFF')
                .textAlign(TextAlign.Center)
                .margin({ bottom: 8 })

              Text(this.t('home.tagline'))
                .fontSize(18)
                .fontColor('#D1FAE5')
                .textAlign(TextAlign.Center)
            }
            .margin({ bottom: 32 })

            // Modules Grid
            Grid() {
              GridItem() {
                this.ModuleCard('pay', '#10B981')
              }
              GridItem() {
                this.ModuleCard('eats', '#F97316')
              }
              GridItem() {
                this.ModuleCard('shop', '#A855F7')
              }
              GridItem() {
                this.ModuleCard('talk', '#3B82F6')
              }
              GridItem() {
                this.ModuleCard('ads', '#EAB308')
              }
              GridItem() {
                this.ModuleCard('free', '#EC4899')
              }
            }
            .columnsTemplate('1fr 1fr')
            .rowsTemplate('1fr 1fr 1fr')
            .columnsGap(12)
            .rowsGap(12)
            .width('90%')
            .margin({ bottom: 32 })

            // Auth Buttons
            Column() {
              Button(this.t('auth.login.submit'))
                .width('90%')
                .height(56)
                .backgroundColor('#FFFFFF')
                .fontColor('#064E3B')
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .borderRadius(16)
                .margin({ bottom: 12 })

              Button(this.t('auth.signup.title'))
                .width('90%')
                .height(56)
                .backgroundColor('rgba(255, 255, 255, 0.1)')
                .fontColor('#FFFFFF')
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .borderRadius(16)
                .border({ width: 2, color: 'rgba(255, 255, 255, 0.3)' })
            }
            .width('100%')
            .margin({ bottom: 16 })

            // Forgot Password
            Text(this.t('auth.forgot_password'))
              .fontSize(14)
              .fontColor('#D1FAE5')
              .decoration({ type: TextDecorationType.Underline })
          }
          .width('100%')
          .padding(20)
        }
        .width('100%')
        .height('100%')
        .linearGradient({
          angle: 180,
          colors: [[0x064E3B, 0.0], [0x047857, 1.0]]
        })

        // Language Picker Sheet
        if (this.showLanguagePicker) {
          Column() {
            Row() {
              Text(this.t('settings.language'))
                .fontSize(20)
                .fontWeight(FontWeight.Bold)
                .fontColor('#111827')

              Text('✕')
                .fontSize(24)
                .fontColor('#6B7280')
                .onClick(() => {
                  this.showLanguagePicker = false;
                })
            }
            .width('100%')
            .justifyContent(FlexAlign.SpaceBetween)
            .padding(24)
            .borderWidth({ bottom: 1 })
            .borderColor('#E5E7EB')

            ForEach(this.i18n.getSupportedLanguages(), (lang: {code: Language; label: string}) => {
              Row() {
                Text(lang.label)
                  .fontSize(16)
                  .fontColor(this.currentLang === lang.code ? '#065F46' : '#374151')
                  .fontWeight(this.currentLang === lang.code ? FontWeight.Bold : FontWeight.Normal)
                  .layoutWeight(1)

                if (this.currentLang === lang.code) {
                  Text('✓')
                    .fontSize(20)
                    .fontColor('#10B981')
                    .fontWeight(FontWeight.Bold)
                }
              }
              .width('100%')
              .padding({ left: 24, right: 24, top: 16, bottom: 16 })
              .backgroundColor(this.currentLang === lang.code ? '#D1FAE5' : '#FFFFFF')
              .borderRadius(12)
              .margin({ left: 12, right: 12, bottom: 8 })
              .onClick(() => {
                this.changeLanguage(lang.code);
              })
            })
          }
          .width('100%')
          .backgroundColor('#FFFFFF')
          .borderRadius({ topLeft: 24, topRight: 24 })
          .position({ x: 0, y: '30%' })
          .height('70%')
        }
      }
    }
    .width('100%')
    .height('100%')
  }

  @Builder ModuleCard(key: string, color: string) {
    Row() {
      Text(this.t(`modules.${key}`))
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor('#FFFFFF')
    }
    .width('100%')
    .aspectRatio(1.5)
    .backgroundColor(color)
    .borderRadius(24)
    .justifyContent(FlexAlign.Center)
    .shadow({ radius: 8, color: '#00000040', offsetY: 4 })
  }

  getLangLabel(code: Language): string {
    const labels: Record<Language, string> = {
      'fr': 'Français',
      'en': 'English',
      'wo': 'Wolof',
      'ar': 'العربية',
      'es': 'Español'
    };
    return labels[code] || code;
  }
}
