import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../../common/services/notification.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async getMyNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const unread = notifications.filter((n) => !n.readAt).length;

    return {
      items: notifications,
      unreadCount: unread,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new Error('Notification not found');
    }

    return this.notificationService.markAsRead(notificationId);
  }

  async markAllAsRead(userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }
}
