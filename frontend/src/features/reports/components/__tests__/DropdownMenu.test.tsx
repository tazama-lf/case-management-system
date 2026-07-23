import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DropdownMenu from '../DropdownMenu';

describe('DropdownMenu', () => {
  const mockOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <DropdownMenu isOpen={false} options={mockOptions} onSelect={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dropdown menu when isOpen is true', () => {
    render(
      <DropdownMenu isOpen={true} options={mockOptions} onSelect={vi.fn()} />,
    );

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('calls onSelect when an option is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <DropdownMenu isOpen={true} options={mockOptions} onSelect={onSelect} />,
    );

    const option2 = screen.getByText('Option 2');
    await user.click(option2);

    expect(onSelect).toHaveBeenCalledWith('option2');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(
      <DropdownMenu
        isOpen={true}
        options={mockOptions}
        onSelect={vi.fn()}
        className="custom-class"
      />,
    );

    const dropdown = container.querySelector('.custom-class');
    expect(dropdown).toBeInTheDocument();
  });

  it('renders all options as buttons', () => {
    render(
      <DropdownMenu isOpen={true} options={mockOptions} onSelect={vi.fn()} />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent('Option 1');
    expect(buttons[1]).toHaveTextContent('Option 2');
    expect(buttons[2]).toHaveTextContent('Option 3');
  });

  it('handles empty options array', () => {
    render(<DropdownMenu isOpen={true} options={[]} onSelect={vi.fn()} />);

    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('handles generic type values', () => {
    const numericOptions = [
      { value: '1', label: 'One' },
      { value: '2', label: 'Two' },
    ];

    const onSelect = vi.fn();

    render(
      <DropdownMenu
        isOpen={true}
        options={numericOptions}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });
});
