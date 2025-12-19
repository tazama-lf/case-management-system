import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatDateFull,
  formatTime,
  formatDateOnly,
  getTimeAgo,
} from '../dateUtils';

describe('dateUtils', () => {
  describe('formatDate', () => {
    it('should format a valid date string', () => {
      const result = formatDate('2024-01-15T10:30:00Z');

      // The exact format will depend on the locale, but it should contain the date parts
      expect(result).toMatch(/Jan/);
      expect(result).toContain('15');
    });

    it('should format a Date object', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = formatDate(date);

      expect(result).toMatch(/Jan/);
      expect(result).toContain('15');
    });

    it('should return "Invalid Date" for invalid date string', () => {
      const result = formatDate('invalid-date');
      expect(result).toBe('Invalid Date');
    });

    it('should return "Invalid Date" for invalid Date object', () => {
      const result = formatDate(new Date('invalid'));
      expect(result).toBe('Invalid Date');
    });
  });

  describe('formatDateFull', () => {
    it('should format a valid date string with full month name', () => {
      const result = formatDateFull('2024-01-15T10:30:00Z');

      expect(result).toMatch(/January/);
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should format a Date object', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = formatDateFull(date);

      expect(result).toMatch(/January/);
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should return "Invalid Date" for invalid input', () => {
      const result = formatDateFull('invalid-date');
      expect(result).toBe('Invalid Date');
    });
  });

  describe('formatTime', () => {
    it('should format time from a date string', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const result = formatTime(date);

      // Should contain time parts
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should format time from a Date object', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const result = formatTime(date);

      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should return "Invalid Time" for invalid input', () => {
      const result = formatTime('invalid-date');
      expect(result).toBe('Invalid Time');
    });
  });

  describe('formatDateOnly', () => {
    it('should format date without time', () => {
      const result = formatDateOnly('2024-01-15T10:30:00Z');

      expect(result).toMatch(/January/);
      expect(result).toContain('15');
      expect(result).toContain('2024');
      // Should not contain time indicators
      expect(result).not.toMatch(/AM|PM|:/);
    });

    it('should format a Date object without time', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = formatDateOnly(date);

      expect(result).toMatch(/January/);
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should return "Invalid Date" for invalid input', () => {
      const result = formatDateOnly('invalid-date');
      expect(result).toBe('Invalid Date');
    });
  });

  describe('getTimeAgo', () => {
    beforeEach(() => {
      // Set a fixed date for consistent testing
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "Just now" for times less than 1 minute ago', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const recent = new Date('2024-01-15T11:59:30Z');

      const result = getTimeAgo(recent, now);
      expect(result).toBe('Just now');
    });

    it('should return minutes ago for times less than 1 hour', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const past = new Date('2024-01-15T11:30:00Z');

      const result = getTimeAgo(past, now);
      expect(result).toBe('30 minutes ago');
    });

    it('should return singular "minute ago" for 1 minute', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const past = new Date('2024-01-15T11:59:00Z');

      const result = getTimeAgo(past, now);
      expect(result).toBe('1 minute ago');
    });

    it('should return hours ago for times less than 24 hours', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const past = new Date('2024-01-15T08:00:00Z');

      const result = getTimeAgo(past, now);
      expect(result).toBe('4 hours ago');
    });

    it('should return singular "hour ago" for 1 hour', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const past = new Date('2024-01-15T11:00:00Z');

      const result = getTimeAgo(past, now);
      expect(result).toBe('1 hour ago');
    });

    it('should return days ago for times less than 30 days', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const past = new Date('2024-01-10T12:00:00Z');

      const result = getTimeAgo(past, now);
      expect(result).toBe('5 days ago');
    });

    it('should return singular "day ago" for 1 day', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const past = new Date('2024-01-14T12:00:00Z');

      const result = getTimeAgo(past, now);
      expect(result).toBe('1 day ago');
    });

    it('should return formatted date for times over 30 days', () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const past = new Date('2024-01-01T12:00:00Z');

      const result = getTimeAgo(past, now);
      expect(result).toMatch(/January/);
      expect(result).toContain('1');
      expect(result).toContain('2024');
    });

    it('should use current time when endDate is not provided', () => {
      const past = new Date('2024-01-15T11:30:00Z');

      const result = getTimeAgo(past);
      expect(result).toBe('30 minutes ago');
    });

    it('should work with date strings', () => {
      const result = getTimeAgo('2024-01-15T11:30:00Z', '2024-01-15T12:00:00Z');
      expect(result).toBe('30 minutes ago');
    });

    it('should return "Invalid Date" for invalid start date', () => {
      const result = getTimeAgo('invalid-date', new Date());
      expect(result).toBe('Invalid Date');
    });

    it('should return "Invalid Date" for invalid end date', () => {
      const result = getTimeAgo(new Date(), 'invalid-date');
      expect(result).toBe('Invalid Date');
    });
  });
});
