import { render, screen } from '@testing-library/react';
import DisputeModal from '@/components/contracts/DisputeModal';

/**
 * What a buyer writes when raising a dispute goes, with personal data patterns stripped, to the
 * model that may decide it. Names and street addresses cannot be stripped mechanically, so the form
 * asks for none.
 */
describe('Raising a dispute: what the buyer is asked', () => {
  it('asks for no names, addresses or contact details, next to the box they write in', () => {
    render(<DisputeModal isOpen onClose={jest.fn()} onSubmit={jest.fn()} />);
    const box = screen.getByPlaceholderText('Please describe the reason for this dispute...');
    const hint = document.getElementById(box.getAttribute('aria-describedby') || '');
    expect(hint?.textContent).toBe("Don't include names, addresses or contact details. They aren't needed to decide the dispute.");
  });

  it('says the figure is a vote', () => {
    render(<DisputeModal isOpen onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.getByText(/This is sent to the contract as your vote\./)).toBeTruthy();
    expect(screen.getByText('Your vote (% to buyer)')).toBeTruthy();
  });
});
