import { deploymentOf, draftToCreateRequest, partiesOf } from '@/utils/projectsServer';
import { ProjectDescendantTree, ProjectDraft, ProjectNode } from '@/types/projects';

const baseDraft = (overrides: Partial<ProjectDraft> = {}): ProjectDraft => ({
  sellerAddress: '0xSeller',
  totalAmount: 100,
  currency: 'USDC',
  description: 'test',
  splitMode: 'amount',
  recipients: [
    { address: '0xA', value: 60 },
    { address: '0xB', value: 40 },
  ],
  serviceLink: 'https://app.example.com',
  ...overrides,
});

describe('draftToCreateRequest', () => {
  it('converts dollar amounts to bps summing to 10000', () => {
    const req = draftToCreateRequest(baseDraft());
    const bps = req.root.recipients.map((r) => r.bps);
    expect(bps).toEqual([6000, 4000]);
    expect(bps.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('converts percentages to bps', () => {
    const req = draftToCreateRequest(
      baseDraft({
        splitMode: 'percent',
        recipients: [
          { address: '0xA', value: 25.5 },
          { address: '0xB', value: 74.5 },
        ],
      })
    );
    expect(req.root.recipients.map((r) => r.bps)).toEqual([2550, 7450]);
  });

  it('forces the bps to sum to exactly 10000 despite rounding', () => {
    const req = draftToCreateRequest(
      baseDraft({
        splitMode: 'percent',
        recipients: [
          { address: '0xA', value: 33.33 },
          { address: '0xB', value: 33.33 },
          { address: '0xC', value: 33.34 },
        ],
      })
    );
    expect(req.root.recipients.map((r) => r.bps).reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('carries through node fields and nulls optionals', () => {
    const req = draftToCreateRequest(baseDraft({ verifierAddress: null, sellerEmail: 'x@y.z' }));
    expect(req.root.sellerAddress).toBe('0xSeller');
    expect(req.root.verifierAddress).toBeNull();
    expect(req.root.sellerEmail).toBe('x@y.z');
    expect(req.root.recipients[0].child).toBeNull();
  });

  it('rejects an empty recipient list', () => {
    expect(() => draftToCreateRequest(baseDraft({ recipients: [] }))).toThrow(/at least one recipient/i);
  });
});

const node = (overrides: Partial<ProjectNode> = {}): ProjectNode => ({
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
  recipients: [{ address: '0xA', bps: 10000, childId: null }],
  chainId: null,
  chainAddress: null,
  description: 'root',
  productName: null,
  createdAt: 0,
  state: 'OK',
  // Signed off by default: most cases here exercise address readiness, and the
  // sign-off rule has its own describe block that clears this explicitly.
  markedReadyAt: 1_700_000_000,
  ...overrides,
});

describe('deploymentOf', () => {
  it('is ready when every wallet address is present, and not yet deployed', () => {
    const d = deploymentOf([node()]);
    expect(d.ready).toBe(true);
    expect(d.missing).toEqual([]);
    expect(d.deployed).toBe(false);
    expect(d.buyerAddress).toBe('0xBuyer');
  });

  it('is not ready without a buyer', () => {
    const d = deploymentOf([node({ buyerAddress: null })]);
    expect(d.ready).toBe(false);
    expect(d.missing.join(' ')).toMatch(/buyer/i);
  });

  it('is not ready when a recipient slice has no address', () => {
    const d = deploymentOf([node({ recipients: [{ address: null, bps: 10000, childId: null }] })]);
    expect(d.ready).toBe(false);
    expect(d.missing.join(' ')).toMatch(/recipient 1/i);
  });

  it('treats a slice pointing at a committed child as complete', () => {
    const parent = node({ recipients: [{ address: null, bps: 10000, childId: 'n2' }] });
    const child = node({ id: 'n2', parentId: 'n1', depth: 1, description: 'child' });
    expect(deploymentOf([parent, child]).ready).toBe(true);
  });

  it('reports a missing supplier on a child node by name', () => {
    const parent = node({ recipients: [{ address: null, bps: 10000, childId: 'n2' }] });
    const child = node({ id: 'n2', parentId: 'n1', depth: 1, description: 'design', sellerAddress: '' });
    const d = deploymentOf([parent, child]);
    expect(d.ready).toBe(false);
    expect(d.missing.join(' ')).toMatch(/design/);
  });

  it('flags a partial deploy so it can be retried', () => {
    const parent = node({ recipients: [{ address: null, bps: 10000, childId: 'n2' }] });
    const child = node({ id: 'n2', parentId: 'n1', depth: 1, chainAddress: '0xDeployed' });
    const d = deploymentOf([parent, child]);
    expect(d.partiallyDeployed).toBe(true);
    expect(d.deployed).toBe(false);
  });

  it('is fully deployed once every node has an address', () => {
    const d = deploymentOf([node({ chainAddress: '0xDeployed' })]);
    expect(d.deployed).toBe(true);
    expect(d.partiallyDeployed).toBe(false);
  });
});

describe('partiesOf', () => {
  const byId = (nodes: ProjectNode[]) => new Map(nodes.map((n) => [n.id, n]));

  it('uses the recorded buyer on a root', () => {
    const root = node();
    const p = partiesOf(root, byId([root]));
    expect(p.effectiveBuyerAddress).toBe('0xBuyer');
    expect(p.buyerFromParent).toBe(false);
  });

  it("inherits a committed child's buyer from the parent's supplier", () => {
    const parent = node({ sellerAddress: '0xLead' });
    // buyerAddress is null on a child until deploy stamps it.
    const child = node({ id: 'n2', parentId: 'n1', depth: 1, buyerAddress: null, sellerAddress: '0xSub' });
    const p = partiesOf(child, byId([parent, child]));
    expect(p.effectiveBuyerAddress).toBe('0xLead');
    expect(p.buyerFromParent).toBe(true);
  });

  it('prefers a recorded buyer over the parent, once deployed', () => {
    const parent = node({ sellerAddress: '0xLead' });
    const child = node({ id: 'n2', parentId: 'n1', depth: 1, buyerAddress: '0xLead', sellerAddress: '0xSub' });
    expect(partiesOf(child, byId([parent, child])).buyerFromParent).toBe(false);
  });

  it('falls back to the buyer when no verifier is nominated', () => {
    const root = node({ verifierAddress: null });
    const p = partiesOf(root, byId([root]));
    expect(p.effectiveVerifierAddress).toBe('0xBuyer');
    expect(p.verifierIsBuyer).toBe(true);
  });

  it('keeps a nominated verifier', () => {
    const root = node({ verifierAddress: '0xVerifier' });
    const p = partiesOf(root, byId([root]));
    expect(p.effectiveVerifierAddress).toBe('0xVerifier');
    expect(p.verifierIsBuyer).toBe(false);
  });
});

describe('deploymentOf with subcontracts below', () => {
  const descendant = (overrides: Partial<ProjectDescendantTree> = {}): ProjectDescendantTree => ({
    groupId: 'g2',
    parentGroupId: 'g1',
    parentNodeId: 'n1',
    description: 'design',
    amount: 40,
    currency: 'USDC',
    currencySymbol: 'USDC',
    chainAddress: null,
    state: 'OK',
    nodeCount: 1,
    nodes: [node({ id: 'sub1', groupId: 'g2' })],
    ...overrides,
  });

  it('stays ready when every subcontract below is complete', () => {
    expect(deploymentOf([node()], { g2: descendant() }).ready).toBe(true);
  });

  it('is blocked by an incomplete subcontract, naming it', () => {
    const blocked = descendant({
      nodes: [node({ id: 'sub1', groupId: 'g2', recipients: [{ address: null, bps: 10000, childId: null }] })],
    });
    const d = deploymentOf([node()], { g2: blocked });
    expect(d.ready).toBe(false);
    expect(d.missing.join(' ')).toMatch(/subcontract "design"/);
  });

  it('is blocked by an incomplete grandchild subcontract too', () => {
    const grandchild = descendant({ groupId: 'g3', parentGroupId: 'g2', description: 'illustration' });
    const blocked = { ...grandchild, nodes: [node({ id: 'sub2', groupId: 'g3', sellerAddress: '' })] };
    const d = deploymentOf([node()], { g2: descendant(), g3: blocked });
    expect(d.ready).toBe(false);
    expect(d.missing.join(' ')).toMatch(/illustration/);
  });
});

describe('deploymentOf and verifier sign-off', () => {
  const approved = (overrides: Partial<ProjectNode> = {}) =>
    node({ markedReadyAt: 1_700_000_000, ...overrides });

  it('is not ready until the verifier has signed off', () => {
    const d = deploymentOf([node({ markedReadyAt: null })]);
    expect(d.ready).toBe(false);
    // Sign-offs are listed apart from missing wallet details.
    expect(d.missing).toEqual([]);
    expect(d.awaitingApproval).toEqual(['"root"']);
  });

  it('is ready once signed off', () => {
    expect(deploymentOf([approved()]).ready).toBe(true);
  });

  it('needs sign-off on every node of the tree', () => {
    const parent = approved({ recipients: [{ address: null, bps: 10000, childId: 'n2' }] });
    const child = node({ id: 'n2', parentId: 'n1', depth: 1, description: 'design', markedReadyAt: null });
    const d = deploymentOf([parent, child]);
    expect(d.ready).toBe(false);
    expect(d.awaitingApproval.join(' ')).toMatch(/design/);
  });

  it('needs sign-off on subcontracts below too', () => {
    const sub: ProjectDescendantTree = {
      groupId: 'g2', parentGroupId: 'g1', parentNodeId: 'n1',
      description: 'design', amount: 40, currency: 'USDC', currencySymbol: 'USDC',
      chainAddress: null, state: 'OK', nodeCount: 1,
      nodes: [node({ id: 'sub1', groupId: 'g2', markedReadyAt: null })],
    };
    const d = deploymentOf([approved()], { g2: sub });
    expect(d.ready).toBe(false);
    expect(d.awaitingApproval.join(' ')).toMatch(/subcontract "design"/);
  });

  it('does not ask for sign-off on contracts already deployed', () => {
    const d = deploymentOf([node({ markedReadyAt: null, chainAddress: '0xLive' })]);
    expect(d.ready).toBe(true);
    expect(d.deployed).toBe(true);
  });
});
