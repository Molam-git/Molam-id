// harmony/feature/admin/AdminConsolePage.ets
import http from '@ohos.net.http';
import preferences from '@ohos.data.preferences';

interface Employee {
  id: string;
  employee_id: string;
  display_name: string;
  email: string;
  department: string;
  position: string;
  is_active: boolean;
  roles?: Array<{ role_name: string }>;
}

interface DepartmentStat {
  department: string;
  active_employees: number;
}

interface AuditLog {
  id: string;
  action: string;
  employee_id?: string;
  department?: string;
  created_at: string;
  context?: Record<string, any>;
}

@Entry
@Component
struct AdminConsolePage {
  @State employees: Employee[] = [];
  @State stats: DepartmentStat[] = [];
  @State audit: AuditLog[] = [];
  @State loading: boolean = true;
  @State filter: string = '';
  @State accessToken: string = '';

  private apiBase: string = 'http://localhost:3001';
  private prefs: preferences.Preferences | null = null;

  async aboutToAppear() {
    try {
      this.prefs = await preferences.getPreferences(getContext(this), 'molam_admin');
      this.accessToken = await this.prefs.get('access_token', '') as string;
      await this.fetchData();
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  }

  async fetchData() {
    try {
      this.loading = true;
      const req = http.createHttp();

      const params = this.filter ? `?department=${this.filter}` : '';

      // Fetch employees
      const empResponse = await req.request(`${this.apiBase}/api/id/admin/employees${params}`, {
        method: http.RequestMethod.GET,
        header: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const empData = JSON.parse(empResponse.result as string);
      this.employees = empData.employees || [];

      // Fetch audit logs
      const auditParams = this.filter ? `?department=${this.filter}&limit=30` : '?limit=30';
      const auditResponse = await req.request(`${this.apiBase}/api/id/admin/audit${auditParams}`, {
        method: http.RequestMethod.GET,
        header: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const auditData = JSON.parse(auditResponse.result as string);
      this.audit = auditData.audit || [];

      // Fetch stats
      const statsResponse = await req.request(`${this.apiBase}/api/id/admin/stats`, {
        method: http.RequestMethod.GET,
        header: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const statsData = JSON.parse(statsResponse.result as string);
      this.stats = statsData.stats || [];

      this.loading = false;
    } catch (err) {
      console.error('Failed to fetch data:', err);
      this.loading = false;
    }
  }

  getDepartmentColor(dept: string): string {
    const colors: Record<string, string> = {
      'pay': '#34D399',
      'eats': '#FB923C',
      'talk': '#60A5FA',
      'shop': '#A78BFA',
      'ads': '#FBBF24',
      'free': '#F472B6',
      'id': '#9CA3AF',
      'global': '#818CF8'
    };
    return colors[dept] || '#9CA3AF';
  }

  build() {
    Column() {
      if (this.loading) {
        Column() {
          LoadingProgress()
            .width(60)
            .height(60)
            .color('#3B82F6')
          Text('Loading admin console...')
            .fontSize(16)
            .fontColor('#6B7280')
            .margin({ top: 16 })
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor('#F9FAFB')
      } else {
        Scroll() {
          Column() {
            // Header
            Column() {
              Text('Molam Admin Console')
                .fontSize(28)
                .fontWeight(FontWeight.Bold)
                .fontColor('#111827')
              Text('Internal employee management by subsidiary')
                .fontSize(14)
                .fontColor('#6B7280')
                .margin({ top: 4 })
            }
            .width('100%')
            .padding(20)
            .backgroundColor('#FFFFFF')
            .borderRadius(0)

            // Department Filter
            Column() {
              Text('Filter by Department:')
                .fontSize(14)
                .fontWeight(FontWeight.Medium)
                .fontColor('#374151')
                .margin({ bottom: 8 })

              Scroll() {
                Row() {
                  this.FilterButton('', 'All Departments')
                  this.FilterButton('pay', 'Molam Pay')
                  this.FilterButton('eats', 'Molam Eats')
                  this.FilterButton('talk', 'Molam Talk')
                  this.FilterButton('ads', 'Molam Ads')
                  this.FilterButton('shop', 'Molam Shop')
                  this.FilterButton('free', 'Molam Free')
                  this.FilterButton('id', 'Molam ID')
                  this.FilterButton('global', 'Global/Corporate')
                }
              }
              .scrollable(ScrollDirection.Horizontal)
              .scrollBar(BarState.Off)
            }
            .width('100%')
            .padding(16)
            .backgroundColor('#FFFFFF')
            .margin({ top: 8 })

            // Statistics
            Column() {
              Text('Department Statistics')
                .fontSize(18)
                .fontWeight(FontWeight.Bold)
                .fontColor('#111827')
                .margin({ bottom: 12 })

              Grid() {
                ForEach(this.stats, (stat: DepartmentStat) => {
                  GridItem() {
                    Column() {
                      Row() {
                        Text(stat.department.toUpperCase())
                          .fontSize(10)
                          .fontColor('#FFFFFF')
                          .fontWeight(FontWeight.Bold)
                      }
                      .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                      .borderRadius(12)
                      .backgroundColor(this.getDepartmentColor(stat.department))
                      .margin({ bottom: 8 })

                      Text(stat.active_employees.toString())
                        .fontSize(24)
                        .fontWeight(FontWeight.Bold)
                        .fontColor('#111827')

                      Text('Active Employees')
                        .fontSize(12)
                        .fontColor('#6B7280')
                        .margin({ top: 2 })
                    }
                    .width('100%')
                    .padding(12)
                    .backgroundColor('#FFFFFF')
                    .borderRadius(12)
                    .shadow({ radius: 2, color: '#00000008', offsetY: 1 })
                  }
                })
              }
              .columnsTemplate('1fr 1fr')
              .columnsGap(8)
              .rowsGap(8)
            }
            .width('100%')
            .padding(16)
            .margin({ top: 8 })

            // Employees
            Column() {
              Text(`Employees (${this.employees.length})`)
                .fontSize(18)
                .fontWeight(FontWeight.Bold)
                .fontColor('#111827')
                .margin({ bottom: 12 })

              ForEach(this.employees, (emp: Employee) => {
                Column() {
                  Row() {
                    Text(emp.display_name)
                      .fontSize(16)
                      .fontWeight(FontWeight.Bold)
                      .fontColor('#111827')
                      .layoutWeight(1)

                    Row() {
                      Text(emp.is_active ? 'Active' : 'Inactive')
                        .fontSize(11)
                        .fontWeight(FontWeight.Medium)
                        .fontColor(emp.is_active ? '#065F46' : '#991B1B')
                    }
                    .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                    .borderRadius(12)
                    .backgroundColor(emp.is_active ? '#D1FAE5' : '#FEE2E2')
                  }
                  .width('100%')
                  .margin({ bottom: 8 })

                  Text(emp.email)
                    .fontSize(13)
                    .fontColor('#6B7280')
                    .margin({ bottom: 8 })

                  Row() {
                    Text('ID:')
                      .fontSize(13)
                      .fontColor('#6B7280')
                      .width(80)
                    Text(emp.employee_id)
                      .fontSize(13)
                      .fontColor('#111827')
                      .layoutWeight(1)
                  }
                  .width('100%')
                  .margin({ top: 4 })

                  Row() {
                    Text('Department:')
                      .fontSize(13)
                      .fontColor('#6B7280')
                      .width(80)
                    Row() {
                      Text(emp.department.toUpperCase())
                        .fontSize(11)
                        .fontColor('#FFFFFF')
                        .fontWeight(FontWeight.Bold)
                    }
                    .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                    .borderRadius(12)
                    .backgroundColor(this.getDepartmentColor(emp.department))
                  }
                  .width('100%')
                  .margin({ top: 4 })

                  Row() {
                    Text('Position:')
                      .fontSize(13)
                      .fontColor('#6B7280')
                      .width(80)
                    Text(emp.position)
                      .fontSize(13)
                      .fontColor('#111827')
                      .layoutWeight(1)
                  }
                  .width('100%')
                  .margin({ top: 4 })

                  if (emp.roles && emp.roles.length > 0) {
                    Row() {
                      Text('Roles:')
                        .fontSize(13)
                        .fontColor('#6B7280')
                        .width(80)
                      Text(emp.roles.map(r => r.role_name).join(', '))
                        .fontSize(13)
                        .fontColor('#111827')
                        .layoutWeight(1)
                    }
                    .width('100%')
                    .margin({ top: 4 })
                  }
                }
                .width('100%')
                .padding(16)
                .backgroundColor('#FFFFFF')
                .borderRadius(12)
                .shadow({ radius: 2, color: '#00000008', offsetY: 1 })
                .margin({ bottom: 12 })
              })
            }
            .width('100%')
            .padding(16)
            .margin({ top: 8 })

            // Audit Logs
            Column() {
              Text('Recent Audit Logs')
                .fontSize(18)
                .fontWeight(FontWeight.Bold)
                .fontColor('#111827')
                .margin({ bottom: 12 })

              ForEach(this.audit, (log: AuditLog) => {
                Column() {
                  Row() {
                    Text(log.action)
                      .fontSize(14)
                      .fontWeight(FontWeight.Medium)
                      .fontColor('#111827')
                      .layoutWeight(1)

                    Text(new Date(log.created_at).toLocaleString())
                      .fontSize(11)
                      .fontColor('#9CA3AF')
                  }
                  .width('100%')
                  .margin({ bottom: 4 })

                  if (log.employee_id) {
                    Text(`by ${log.employee_id}`)
                      .fontSize(12)
                      .fontColor('#6B7280')
                      .margin({ top: 2 })
                  }

                  if (log.department) {
                    Row() {
                      Text(log.department)
                        .fontSize(10)
                        .fontColor('#FFFFFF')
                        .fontWeight(FontWeight.Bold)
                    }
                    .padding({ left: 6, right: 6, top: 2, bottom: 2 })
                    .borderRadius(8)
                    .backgroundColor(this.getDepartmentColor(log.department))
                    .margin({ top: 4 })
                  }

                  if (log.context && Object.keys(log.context).length > 0) {
                    Text(JSON.stringify(log.context))
                      .fontSize(11)
                      .fontColor('#9CA3AF')
                      .fontFamily('monospace')
                      .margin({ top: 4 })
                  }
                }
                .width('100%')
                .padding(12)
                .backgroundColor('#FFFFFF')
                .borderRadius(12)
                .borderWidth({ left: 3 })
                .borderColor({ left: '#3B82F6' })
                .margin({ bottom: 8 })
              })
            }
            .width('100%')
            .padding(16)
            .margin({ top: 8 })
          }
        }
        .width('100%')
        .height('100%')
        .backgroundColor('#F9FAFB')
      }
    }
    .width('100%')
    .height('100%')
  }

  @Builder FilterButton(value: string, label: string) {
    Row() {
      Text(label)
        .fontSize(13)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.filter === value ? '#FFFFFF' : '#374151')
    }
    .padding({ left: 16, right: 16, top: 8, bottom: 8 })
    .borderRadius(20)
    .backgroundColor(this.filter === value ? '#3B82F6' : '#F3F4F6')
    .margin({ right: 8 })
    .onClick(() => {
      this.filter = value;
      this.fetchData();
    })
  }
}
