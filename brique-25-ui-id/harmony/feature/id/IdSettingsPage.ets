// harmony/feature/id/IdSettingsPage.ets
// Molam ID Management - HarmonyOS Native App (ArkTS)

import http from '@ohos.net.http';
import router from '@ohos.router';
import preferences from '@ohos.data.preferences';

@Entry
@Component
struct IdSettingsPage {
  @State me: any = null;
  @State sessions: any[] = [];
  @State devices: any[] = [];
  @State loading: boolean = true;
  @State activeTab: string = 'profile';
  private apiBase: string = 'https://api.molam.com';
  private accessToken: string = '';

  async aboutToAppear() {
    await this.loadAccessToken();
    await this.fetchData();
  }

  async loadAccessToken() {
    try {
      const prefs = await preferences.getPreferences(getContext(), 'molam_auth');
      this.accessToken = await prefs.get('access_token', '') as string;
    } catch (err) {
      console.error('Error loading token:', err);
    }
  }

  async fetchData() {
    this.loading = true;
    await Promise.all([
      this.fetchMe(),
      this.fetchSessions(),
      this.fetchDevices()
    ]);
    this.loading = false;
  }

  async fetchMe() {
    const req = http.createHttp();
    try {
      const response = await req.request(`${this.apiBase}/api/id/me`, {
        method: http.RequestMethod.GET,
        header: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      if (response.responseCode === 200) {
        this.me = JSON.parse(response.result.toString());
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      req.destroy();
    }
  }

  async fetchSessions() {
    const req = http.createHttp();
    try {
      const response = await req.request(`${this.apiBase}/api/id/security/sessions`, {
        method: http.RequestMethod.GET,
        header: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      if (response.responseCode === 200) {
        const data = JSON.parse(response.result.toString());
        this.sessions = data.sessions ?? [];
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      req.destroy();
    }
  }

  async fetchDevices() {
    const req = http.createHttp();
    try {
      const response = await req.request(`${this.apiBase}/api/id/security/devices`, {
        method: http.RequestMethod.GET,
        header: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      if (response.responseCode === 200) {
        const data = JSON.parse(response.result.toString());
        this.devices = data.devices ?? [];
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      req.destroy();
    }
  }

  async revokeSession(id: string) {
    const req = http.createHttp();
    try {
      await req.request(`${this.apiBase}/api/id/security/sessions/${id}/revoke`, {
        method: http.RequestMethod.POST,
        header: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        extraData: '{}'
      });
      await this.fetchSessions();
    } catch (err) {
      console.error('Error revoking session:', err);
    } finally {
      req.destroy();
    }
  }

  async revokeDevice(deviceId: string) {
    const req = http.createHttp();
    try {
      await req.request(`${this.apiBase}/api/id/security/devices/${deviceId}/revoke`, {
        method: http.RequestMethod.POST,
        header: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        extraData: '{}'
      });
      await this.fetchDevices();
    } catch (err) {
      console.error('Error revoking device:', err);
    } finally {
      req.destroy();
    }
  }

  build() {
    Column({ space: 0 }) {
      // Header
      Row() {
        Text('Molam ID')
          .fontSize(24)
          .fontWeight(FontWeight.Bold)
          .fontColor('#111827')
      }
      .width('100%')
      .padding(16)
      .backgroundColor('#FFFFFF')

      // Tabs
      Row({ space: 12 }) {
        Button('Profile', { type: ButtonType.Normal })
          .backgroundColor(this.activeTab === 'profile' ? '#3b82f6' : '#e5e7eb')
          .fontColor(this.activeTab === 'profile' ? '#FFFFFF' : '#6b7280')
          .onClick(() => {
            this.activeTab = 'profile';
          })
        Button('Sessions', { type: ButtonType.Normal })
          .backgroundColor(this.activeTab === 'sessions' ? '#3b82f6' : '#e5e7eb')
          .fontColor(this.activeTab === 'sessions' ? '#FFFFFF' : '#6b7280')
          .onClick(() => {
            this.activeTab = 'sessions';
          })
        Button('Devices', { type: ButtonType.Normal })
          .backgroundColor(this.activeTab === 'devices' ? '#3b82f6' : '#e5e7eb')
          .fontColor(this.activeTab === 'devices' ? '#FFFFFF' : '#6b7280')
          .onClick(() => {
            this.activeTab = 'devices';
          })
      }
      .width('100%')
      .padding(16)
      .backgroundColor('#FFFFFF')

      Scroll() {
        Column({ space: 12 }) {
          // Profile Tab
          if (this.activeTab === 'profile') {
            if (this.me) {
              Column({ space: 8 }) {
                Text(`${this.me.display_name}`)
                  .fontSize(20)
                  .fontWeight(FontWeight.Bold)
                  .fontColor('#111827')
                Text(`${this.me.email ?? '—'} | ${this.me.phone ?? '—'}`)
                  .fontSize(14)
                  .fontColor('#6b7280')
                Text(`${this.me.user_type === 'internal' ? 'Internal' : 'External'}`)
                  .fontSize(12)
                  .fontColor('#3b82f6')
              }
              .width('100%')
              .padding(16)
              .backgroundColor('#FFFFFF')
              .borderRadius(16)
            } else {
              Text('Loading...')
                .fontSize(14)
                .fontColor('#6b7280')
            }
          }

          // Sessions Tab
          if (this.activeTab === 'sessions') {
            ForEach(this.sessions, (session) => {
              Row() {
                Column() {
                  Text(`${session.device_type?.toUpperCase()} — ${session.device_id}`)
                    .fontSize(14)
                    .fontWeight(FontWeight.Medium)
                    .fontColor('#111827')
                  Text(`${session.ip_address ?? '—'} • since ${session.created_at}`)
                    .fontSize(12)
                    .fontColor('#6b7280')
                    .margin({ top: 4 })
                }
                .width('70%')
                .alignItems(HorizontalAlign.Start)

                Button('Revoke', { type: ButtonType.Capsule })
                  .fontSize(12)
                  .fontColor('#dc2626')
                  .backgroundColor('#fee2e2')
                  .onClick(() => this.revokeSession(session.id))
              }
              .width('100%')
              .backgroundColor('#FFFFFF')
              .padding(12)
              .borderRadius(16)
            }, (session) => session.id)
          }

          // Devices Tab
          if (this.activeTab === 'devices') {
            ForEach(this.devices, (device) => {
              Row() {
                Column() {
                  Text(`${device.device_name ?? device.device_type?.toUpperCase()}`)
                    .fontSize(14)
                    .fontWeight(FontWeight.Medium)
                    .fontColor('#111827')
                  Text(`${device.is_trusted ? 'Trusted' : 'Untrusted'} • ${device.last_seen_at}`)
                    .fontSize(12)
                    .fontColor('#6b7280')
                    .margin({ top: 4 })
                }
                .width('70%')
                .alignItems(HorizontalAlign.Start)

                Button('Revoke', { type: ButtonType.Capsule })
                  .fontSize(12)
                  .fontColor('#dc2626')
                  .backgroundColor('#fee2e2')
                  .onClick(() => this.revokeDevice(device.device_id))
              }
              .width('100%')
              .backgroundColor('#FFFFFF')
              .padding(12)
              .borderRadius(16)
            }, (device) => device.id)
          }
        }
        .width('100%')
        .padding(16)
      }
      .flexGrow(1)
      .backgroundColor('#f6f7f9')
    }
    .width('100%')
    .height('100%')
  }
}
