// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';
import React from 'react';

describe('StatusBadge Component', () => {
  it('renders ACTIVE status correctly', () => {
    render(<StatusBadge status="ACTIVE" />);
    expect(screen.getByText('Đang dùng')).toBeTruthy();
  });

  it('renders TRIAL status correctly', () => {
    render(<StatusBadge status="TRIAL" />);
    expect(screen.getByText('Dùng thử')).toBeTruthy();
  });
});
