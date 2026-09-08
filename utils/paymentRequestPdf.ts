/**
 * Builds the attachable "payment request" document.
 *
 * Deliberately NOT called an invoice. A tax invoice needs a sequential number,
 * the seller's trading name, address and tax registration, the buyer's details
 * and a net/tax/gross breakdown — none of which this flow collects. Emitting a
 * document labelled "Invoice" without them would fail a buyer's AP process and
 * is worse than emitting an honest payment request. Proper invoicing needs a
 * seller business profile behind it; this is the document we can issue today.
 *
 * The buyer receiving this may never have heard of the product, so the page
 * carries its own explanation — an unexplained payment link from an unfamiliar
 * brand is exactly what a scam looks like.
 *
 * jsPDF is imported dynamically so it only loads for sellers who ask for the
 * PDF, rather than riding along in the main bundle.
 */

export interface PaymentRequestDoc {
  /** Human amount with token symbol, e.g. "25 USDC". */
  formattedAmount: string;
  description: string;
  paymentLink: string;
  /** Data URL for the QR PNG, from the off-screen canvas on the send screen. */
  qrDataUrl?: string;
  networkLabel?: string;
  payoutDate?: string;
  siteName: string;
}

// Mirrors the tailwind palette so the document reads as part of the product.
const INK: [number, number, number] = [15, 23, 42]; // secondary-900
const MUTED: [number, number, number] = [100, 116, 139]; // secondary-500
const FAINT: [number, number, number] = [148, 163, 184]; // secondary-400
const GREEN: [number, number, number] = [5, 150, 105]; // primary-600
const RULE: [number, number, number] = [226, 232, 240]; // secondary-200
const TINT: [number, number, number] = [248, 250, 252]; // secondary-50

const M = 18; // page margin
const PAGE_W = 210;
const CONTENT_W = PAGE_W - M * 2;

export async function downloadPaymentRequestPdf(doc: PaymentRequestDoc): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

  const ink = (c: [number, number, number]) => pdf.setTextColor(c[0], c[1], c[2]);
  const fill = (c: [number, number, number]) => pdf.setFillColor(c[0], c[1], c[2]);

  /** Wrapped paragraph; returns the y position just past it. */
  const para = (
    text: string,
    x: number,
    y: number,
    width: number,
    size: number,
    lineHeight = 4.6
  ): number => {
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, width) as string[];
    pdf.text(lines, x, y);
    return y + lines.length * lineHeight;
  };

  // ---- Header: the site wordmark, matching Header.tsx -----------------------
  let y = M + 4;
  pdf.setFont('helvetica', 'bolditalic');
  pdf.setFontSize(17);
  ink(INK);
  pdf.text(doc.siteName, M, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  ink(GREEN);
  pdf.text('Conduit UCPI', M, y + 4.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  ink(FAINT);
  pdf.text('PAYMENT REQUEST', PAGE_W - M, y, { align: 'right' });

  // Accent rule under the masthead.
  y += 10;
  fill(GREEN);
  pdf.rect(M, y, CONTENT_W, 1.1, 'F');

  // ---- Amount --------------------------------------------------------------
  y += 14;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  ink(MUTED);
  pdf.text('AMOUNT REQUESTED', M, y);

  y += 11;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(30);
  ink(INK);
  pdf.text(doc.formattedAmount, M, y);

  // ---- Detail rows ---------------------------------------------------------
  const detail = (label: string, value: string) => {
    y += 9;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    ink(MUTED);
    pdf.text(label, M, y);
    pdf.setFontSize(10.5);
    ink(INK);
    const lines = pdf.splitTextToSize(value, CONTENT_W - 40) as string[];
    pdf.text(lines, M + 40, y);
    y += (lines.length - 1) * 4.8;
  };

  y += 5;
  if (doc.description) detail('For', doc.description);
  if (doc.payoutDate) detail('Funds released', doc.payoutDate);
  if (doc.networkLabel) detail('Network', doc.networkLabel);

  // ---- How to pay ----------------------------------------------------------
  y += 12;
  const boxTop = y;
  const boxH = 46;
  fill(TINT);
  pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  pdf.roundedRect(M, boxTop, CONTENT_W, boxH, 2.5, 2.5, 'FD');

  const qrSize = 34;
  const textW = CONTENT_W - (doc.qrDataUrl ? qrSize + 18 : 0) - 12;

  let by = boxTop + 10;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11.5);
  ink(INK);
  pdf.text('How to pay', M + 6, by);

  by += 6;
  pdf.setFont('helvetica', 'normal');
  ink(MUTED);
  by = para(
    'Open the link below, or scan the QR code with your phone camera. You can pay from any wallet holding stablecoins.',
    M + 6,
    by,
    textW,
    9,
    4.2
  );

  by += 2.5;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  ink(GREEN);
  const linkLines = pdf.splitTextToSize(doc.paymentLink, textW) as string[];
  pdf.textWithLink(linkLines.join('\n'), M + 6, by, { url: doc.paymentLink });

  if (doc.qrDataUrl) {
    pdf.addImage(
      doc.qrDataUrl,
      'PNG',
      PAGE_W - M - qrSize - 6,
      boxTop + (boxH - qrSize) / 2,
      qrSize,
      qrSize
    );
  }

  y = boxTop + boxH + 14;

  // ---- What this is --------------------------------------------------------
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11.5);
  ink(INK);
  pdf.text(`What is ${doc.siteName}?`, M, y);

  y += 6;
  pdf.setFont('helvetica', 'normal');
  ink(MUTED);
  y = para(
    `${doc.siteName} is an escrow service for stablecoin payments. Rather than paying the seller ` +
      'directly, your payment is held by a smart contract and only released to them on the agreed ' +
      'date below — so you are not sending money into thin air, and the seller is not waiting on a ' +
      'bank. Payments are made in USDC, a stablecoin pegged to the US dollar.',
    M,
    y,
    CONTENT_W,
    9.5,
    4.6
  );

  // ---- Protection ----------------------------------------------------------
  y += 8;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11.5);
  ink(INK);
  pdf.text('How you are protected', M, y);

  y += 7;
  const bullets = [
    'Your funds are held by an open-source smart contract — not by the seller, and not by us.',
    'The money is released to the seller automatically on the payout date shown above.',
    'If something goes wrong, you can raise a dispute before that date to freeze the funds.',
    'The contracts keep running even if our servers do not. Nobody can seize or reverse them.',
  ];
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  for (const b of bullets) {
    fill(GREEN);
    pdf.circle(M + 1.4, y - 1.3, 0.9, 'F');
    ink(MUTED);
    const lines = pdf.splitTextToSize(b, CONTENT_W - 7) as string[];
    pdf.text(lines, M + 6, y);
    y += lines.length * 4.4 + 2.6;
  }

  // ---- Footer --------------------------------------------------------------
  const footY = 279;
  pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  pdf.line(M, footY - 7, PAGE_W - M, footY - 7);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  ink(FAINT);
  pdf.text(
    'This is a payment request, not a tax invoice.',
    M,
    footY - 2
  );
  pdf.text(doc.siteName, PAGE_W - M, footY - 2, { align: 'right' });

  pdf.save('payment-request.pdf');
}
