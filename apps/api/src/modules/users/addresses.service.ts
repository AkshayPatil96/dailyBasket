import { Injectable, NotFoundException } from '@nestjs/common';
import { Address } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAddressDto } from './dto/create-address.dto';
import type { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    const existingCount = await this.prisma.address.count({
      where: { userId, deletedAt: null },
    });
    // First address for a user is always the default, regardless of what's passed.
    const isDefault = dto.isDefault === true || existingCount === 0;
    const data = { ...this.projectCreateFields(dto), userId, isDefault };

    if (!isDefault) {
      return this.prisma.address.create({ data });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, deletedAt: null },
        data: { isDefault: false },
      });
      return tx.address.create({ data });
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.assertOwned(userId, id);
    const fields = this.projectUpdateFields(dto);

    if (dto.isDefault === true && !address.isDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: { userId, deletedAt: null },
          data: { isDefault: false },
        });
        return tx.address.update({
          where: { id },
          data: { ...fields, isDefault: true },
        });
      });
    }

    return this.prisma.address.update({ where: { id }, data: fields });
  }

  // Explicit field projection — never spread a DTO into a Prisma `data` object
  // that also carries userId/isDefault, since a later-added DTO field with a
  // matching key would silently win the object-literal merge.
  private projectCreateFields(dto: CreateAddressDto) {
    return {
      label: dto.label,
      recipientName: dto.recipientName,
      phone: dto.phone,
      line1: dto.line1,
      line2: dto.line2,
      landmark: dto.landmark,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      postalCode: dto.postalCode,
      latitude: dto.latitude,
      longitude: dto.longitude,
      formattedAddress: dto.formattedAddress,
    };
  }

  private projectUpdateFields(dto: UpdateAddressDto) {
    return {
      label: dto.label,
      recipientName: dto.recipientName,
      phone: dto.phone,
      line1: dto.line1,
      line2: dto.line2,
      landmark: dto.landmark,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      postalCode: dto.postalCode,
      latitude: dto.latitude,
      longitude: dto.longitude,
      formattedAddress: dto.formattedAddress,
    };
  }

  async setDefault(userId: string, id: string): Promise<Address> {
    await this.assertOwned(userId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, deletedAt: null },
        data: { isDefault: false },
      });
      return tx.address.update({ where: { id }, data: { isDefault: true } });
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    await this.prisma.address.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Not-found (not forbidden) on ownership mismatch — don't reveal that another user's address id exists.
  private async assertOwned(userId: string, id: string): Promise<Address> {
    const address = await this.prisma.address.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }
}
