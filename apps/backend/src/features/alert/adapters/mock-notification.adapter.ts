import type {
  INotificationService,
  SoftAlertInput,
  RedAlertInput,
} from '../domain/notification.interface';

export class MockNotificationService implements INotificationService {
  public sentSoftAlerts: SoftAlertInput[] = [];
  public sentRedAlerts: RedAlertInput[] = [];

  async sendSoftAlert(input: SoftAlertInput): Promise<boolean> {
    this.sentSoftAlerts.push(input);
    return true;
  }

  async sendRedAlert(input: RedAlertInput): Promise<boolean> {
    this.sentRedAlerts.push(input);
    return true;
  }

  clear(): void {
    this.sentSoftAlerts = [];
    this.sentRedAlerts = [];
  }
}
