import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, channel: string, title: string, message: string) {
    return this.prisma.notification.create({
      data: { userId, channel, title, message },
    });
  }

  async notifyMember(userId: string, title: string, message: string) {
    return this.notify(userId, 'IN_APP', title, message);
  }

  async getUnread(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async broadcast(channel: string, title: string, message: string, userIds?: string[]) {
    if (userIds && userIds.length > 0) {
      return this.prisma.notification.createMany({
        data: userIds.map((userId) => ({ userId, channel, title, message })),
      });
    }

    const users = await this.prisma.user.findMany({ select: { id: true } });
    return this.prisma.notification.createMany({
      data: users.map((user) => ({ userId: user.id, channel, title, message })),
    });
  }
}
