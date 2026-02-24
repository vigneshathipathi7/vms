import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CaptchaVerifyResult {
  success: boolean;
  score?: number;
  action?: string;
  errorCodes?: string[];
}

/**
 * CAPTCHA verification service supporting both Google reCAPTCHA and hCaptcha.
 * 
 * Environment variables:
 * - CAPTCHA_PROVIDER: 'recaptcha' | 'hcaptcha' | 'disabled' (default: 'disabled')
 * - CAPTCHA_SECRET_KEY: Secret key from captcha provider
 * - CAPTCHA_MIN_SCORE: Minimum score for reCAPTCHA v3 (default: 0.5)
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly provider: string;
  private readonly secretKey: string;
  private readonly minScore: number;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<string>('CAPTCHA_PROVIDER', 'disabled');
    this.secretKey = this.configService.get<string>('CAPTCHA_SECRET_KEY', '');
    this.minScore = this.configService.get<number>('CAPTCHA_MIN_SCORE', 0.5);
  }

  /**
   * Verify a CAPTCHA token.
   * Returns true if CAPTCHA is disabled or token is valid.
   */
  async verify(token: string | undefined, remoteIp?: string): Promise<CaptchaVerifyResult> {
    // If CAPTCHA is disabled, always pass
    if (this.provider === 'disabled') {
      this.logger.debug('CAPTCHA verification disabled');
      return { success: true };
    }

    // If no token provided when CAPTCHA is enabled, fail
    if (!token) {
      this.logger.warn('CAPTCHA token missing');
      return {
        success: false,
        errorCodes: ['missing-input-response'],
      };
    }

    try {
      if (this.provider === 'recaptcha') {
        return await this.verifyRecaptcha(token, remoteIp);
      } else if (this.provider === 'hcaptcha') {
        return await this.verifyHcaptcha(token, remoteIp);
      } else {
        this.logger.warn(`Unknown CAPTCHA provider: ${this.provider}`);
        return { success: true }; // Fail open if misconfigured
      }
    } catch (error) {
      this.logger.error('CAPTCHA verification error:', error);
      return {
        success: false,
        errorCodes: ['verification-failed'],
      };
    }
  }

  /**
   * Verify Google reCAPTCHA v2/v3 token.
   */
  private async verifyRecaptcha(token: string, remoteIp?: string): Promise<CaptchaVerifyResult> {
    const url = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: this.secretKey,
      response: token,
      ...(remoteIp && { remoteip: remoteIp }),
    });

    const response = await fetch(url, {
      method: 'POST',
      body: params,
    });

    const data = await response.json() as {
      success: boolean;
      score?: number;
      action?: string;
      'error-codes'?: string[];
    };

    this.logger.debug(`reCAPTCHA response: ${JSON.stringify(data)}`);

    // For reCAPTCHA v3, also check the score
    if (data.success && data.score !== undefined) {
      if (data.score < this.minScore) {
        this.logger.warn(`reCAPTCHA score too low: ${data.score} < ${this.minScore}`);
        return {
          success: false,
          score: data.score,
          action: data.action,
          errorCodes: ['low-score'],
        };
      }
    }

    return {
      success: data.success,
      score: data.score,
      action: data.action,
      errorCodes: data['error-codes'],
    };
  }

  /**
   * Verify hCaptcha token.
   */
  private async verifyHcaptcha(token: string, remoteIp?: string): Promise<CaptchaVerifyResult> {
    const url = 'https://hcaptcha.com/siteverify';
    const params = new URLSearchParams({
      secret: this.secretKey,
      response: token,
      ...(remoteIp && { remoteip: remoteIp }),
    });

    const response = await fetch(url, {
      method: 'POST',
      body: params,
    });

    const data = await response.json() as {
      success: boolean;
      'error-codes'?: string[];
    };

    this.logger.debug(`hCaptcha response: ${JSON.stringify(data)}`);

    return {
      success: data.success,
      errorCodes: data['error-codes'],
    };
  }

  /**
   * Check if CAPTCHA is enabled.
   */
  isEnabled(): boolean {
    return this.provider !== 'disabled';
  }

  /**
   * Get the CAPTCHA provider type.
   */
  getProvider(): string {
    return this.provider;
  }
}
