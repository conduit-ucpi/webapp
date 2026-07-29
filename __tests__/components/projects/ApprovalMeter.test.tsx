import { render, screen } from '@testing-library/react';
import ApprovalMeter from '@/components/projects/ApprovalMeter';

describe('ApprovalMeter', () => {
  it('counts sign-offs across the whole chain, in words as well as colour', () => {
    render(<ApprovalMeter total={5} approved={3} />);
    expect(screen.getByText(/3 of 5 contracts verified/)).toBeInTheDocument();
  });

  it('says when the chain is fully verified and can be deployed', () => {
    render(<ApprovalMeter total={5} approved={5} />);
    expect(screen.getByText(/All 5 contracts verified/)).toBeInTheDocument();
  });

  it('calls out contracts waiting on the viewer', () => {
    render(<ApprovalMeter total={5} approved={3} awaitingYou={2} />);
    expect(screen.getByText(/2 need your approval/)).toBeInTheDocument();
  });

  it('uses the singular for one outstanding approval', () => {
    render(<ApprovalMeter total={5} approved={4} awaitingYou={1} />);
    expect(screen.getByText(/1 needs your approval/)).toBeInTheDocument();
  });

  it('disappears once every contract is on-chain', () => {
    const { container } = render(<ApprovalMeter total={5} approved={5} deployed={5} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the service did not send the counts', () => {
    // Better silent than claiming nothing is verified.
    const { container } = render(<ApprovalMeter />);
    expect(container).toBeEmptyDOMElement();
  });

  it('describes the meter for screen readers', () => {
    render(<ApprovalMeter total={5} approved={3} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '3 of 5 contracts verified');
  });
});
