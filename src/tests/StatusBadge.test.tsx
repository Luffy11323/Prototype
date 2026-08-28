import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge from '../components/StatusBadge';

describe('StatusBadge Component', () => {
  it('should render the correct text label for pending status', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByTestId('status-badge-pending');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Pending');
    expect(badge).toHaveClass('text-amber-400');
  });

  it('should render the correct text label for confirmed status', () => {
    render(<StatusBadge status="confirmed" />);
    const badge = screen.getByTestId('status-badge-confirmed');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Confirmed');
    expect(badge).toHaveClass('text-blue-400');
  });

  it('should render the correct text label for delivered status', () => {
    render(<StatusBadge status="delivered" />);
    const badge = screen.getByTestId('status-badge-delivered');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Delivered');
    expect(badge).toHaveClass('text-purple-400');
  });

  it('should render the correct text label for paid status', () => {
    render(<StatusBadge status="paid" />);
    const badge = screen.getByTestId('status-badge-paid');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Paid');
    expect(badge).toHaveClass('text-emerald-400');
  });
});
