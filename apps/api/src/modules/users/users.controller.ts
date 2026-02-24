import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthCookieGuard } from '../auth/guards/auth-cookie.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateSubUserDto } from './dto/create-sub-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSubUserDto } from './dto/update-sub-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthCookieGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  updateProfile(
    @Body() body: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.usersService.updateProfile(body, user);
  }

  @Get('sub-users')
  @Roles('ADMIN')
  getSubUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listSubUsers(user.candidateId);
  }

  @Post('sub-users')
  @Roles('ADMIN')
  createSubUser(
    @Body() body: CreateSubUserDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.usersService.createSubUser(body, user);
  }

  @Patch('sub-users/:id')
  @Roles('ADMIN')
  updateSubUser(
    @Param('id') id: string,
    @Body() body: UpdateSubUserDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.usersService.updateSubUser(id, body, user);
  }

  @Delete('sub-users/:id')
  @Roles('ADMIN')
  deleteSubUser(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.usersService.deleteSubUser(id, user);
  }
}
