import { render, screen } from '@testing-library/react';
import ApprovalMeter from '@/components/projects/ApprovalMeter';
import { ProjectNodeView } from '@/types/projects';

const project = (overrides: Partial<ProjectNodeView> = {}): ProjectNodeView =>
  ({
    id: 'n1',
    groupId: 'g1',
    parentId: null,
    depth: 0,
    sellerEmail: null,
    sellerAddress: '0xSeller',
    buyerEmail: null,
    buyerAddress: '0xBuyer',
    verifierAddress: null,
    amount: 100,
    currency: 'USDC',
    currencySymbol: 'USDC',
    recipients: [],
    chainId: null,
    chainAddress: null,
    description: 'test',
    productName: null,
    createdAt: 0,
    state: 'OK',
    chainState: null,
    viewerRoles: [],
    effectiveBuyerAddress: '0xBuyer',
    buyerFromParent: false,
    effectiveVerifierAddress: '0xBuyer',
    verifierIsBuyer: true,
    feeBaseUnits: '0',
    recipientPayoutsBaseUnits: [],
    nodeCount: 5,
    approvedCount: 3,
    deployedCount: 0,
    awaitingYouCount: 0,
    ...overrides,
  }) as ProjectNodeView;

describe('ApprovalMeter', () => {
  it('counts approvals across the whole chain, in words as well as colour', () => {
    render(<ApprovalMeter project={project()} />);
    expect(screen.getByText(/3 of 5 contracts approved/)).toBeInTheDocument();
  });

  it('says when the chain is fully approved and can be deployed', () => {
    render(<ApprovalMeter project={project({ approvedCount: 5 })} />);
    expect(screen.getByText(/All 5 contracts approved/)).toBeInTheDocument();
  });

  it('calls out contracts waiting on the viewer', () => {
    render(<ApprovalMeter project={project({ awaitingYouCount: 2 })} />);
    expect(screen.getByText(/2 need your approval/)).toBeInTheDocument();
  });

  it('uses the singular for one outstanding approval', () => {
    render(<ApprovalMeter project={project({ awaitingYouCount: 1 })} />);
    expect(screen.getByText(/1 needs your approval/)).toBeInTheDocument();
  });

  it('disappears once every contract is on-chain', () => {
    const { container } = render(
      <ApprovalMeter project={project({ deployedCount: 5, approvedCount: 5 })} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('describes the meter for screen readers', () => {
    render(<ApprovalMeter project={project()} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      '3 of 5 contracts approved by their verifier'
    );
  });
});

describe('ApprovalMeter without rollup data', () => {
  it('renders nothing when the service did not send the counts', () => {
    const stale = project();
    delete (stale as Partial<ProjectNodeView>).approvedCount;
    delete (stale as Partial<ProjectNodeView>).nodeCount;
    const { container } = render(<ApprovalMeter project={stale} />);
    // Better silent than claiming nothing is approved.
    expect(container).toBeEmptyDOMElement();
  });
});
