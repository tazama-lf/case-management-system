import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';

@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, AuthService],
  exports: [PassportModule, JwtStrategy, AuthService],
})
export class AuthModule {}