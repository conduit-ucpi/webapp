import { useState, useMemo } from 'react';
import SEO from '@/components/SEO';

interface CostRow {
  label: string;
  traditional: number;
  stablecoin: number;
  traditionalNote: string;
  stablecoinNote: string;
  highlight: boolean;
}

interface Calculations {
  yearlyVolume: number;
  yearlyTransactions: number;
  yearlyChargebacks: number;
  rows: CostRow[];
  traditionalTotal: number;
  traditionalPercent: number;
  stablecoinTotal: number;
  stablecoinPercent: number;
  annualSavings: number;
  savingsPercent: number;
  currentProfit: number | null;
  profitIncrease: number | null;
  newProfit: number | null;
}

export default function MerchantSavingsCalculator() {
  const [monthlyVolume, setMonthlyVolume] = useState(25000);
  const [avgTransaction, setAvgTransaction] = useState(75);
  const [chargebackRate, setChargebackRate] = useState(0.5);
  const [profitMargin, setProfitMargin] = useState<number | null>(null);

  const calculations: Calculations = useMemo(() => {
    const monthlyTransactions = monthlyVolume / avgTransaction;
    const yearlyVolume = monthlyVolume * 12;
    const yearlyTransactions = monthlyTransactions * 12;
    const yearlyChargebacks = Math.round(yearlyTransactions * (chargebackRate / 100));

    // Traditional card costs
    const interchange = yearlyVolume * 0.02;
    const networkFee = yearlyVolume * 0.0014;
    const processorMarkup = yearlyVolume * 0.004;
    const perTransactionFee = yearlyTransactions * 0.25;
    const pciCompliance = 300;
    const chargebackFees = yearlyChargebacks * 20;
    const fraudLosses = yearlyVolume * 0.005;
    const floatCost = (monthlyVolume * 0.08 * 3) / 365 * 12;

    const traditionalTotal = interchange + networkFee + processorMarkup +
      perTransactionFee + pciCompliance + chargebackFees + fraudLosses + floatCost;

    const traditionalPercent = (traditionalTotal / yearlyVolume) * 100;

    // Stablecoin escrow costs
    const escrowFee = yearlyVolume * 0.01;

    const stablecoinTotal = escrowFee;
    const stablecoinPercent = (stablecoinTotal / yearlyVolume) * 100;

    const annualSavings = traditionalTotal - stablecoinTotal;
    const savingsPercent = (annualSavings / traditionalTotal) * 100;

    // Profit calculations (only if margin provided)
    const currentProfit = profitMargin ? yearlyVolume * (profitMargin / 100) : null;
    const profitIncrease = currentProfit ? (annualSavings / currentProfit) * 100 : null;
    const newProfit = currentProfit ? currentProfit + annualSavings : null;

    return {
      yearlyVolume,
      yearlyTransactions: Math.round(yearlyTransactions),
      yearlyChargebacks,
      rows: [
        {
          label: 'Payment processing fee',
          traditional: 0,
          stablecoin: escrowFee,
          traditionalNote: 'Broken out below',
          stablecoinNote: '1% — that\'s it',
          highlight: false
        },
        {
          label: 'Interchange fees',
          traditional: interchange,
          stablecoin: 0,
          traditionalNote: '~2% to issuing bank',
          stablecoinNote: 'No intermediaries',
          highlight: true
        },
        {
          label: 'Network fees',
          traditional: networkFee,
          stablecoin: 0,
          traditionalNote: '0.14% to Visa/MC',
          stablecoinNote: 'No card network',
          highlight: true
        },
        {
          label: 'Processor markup',
          traditional: processorMarkup,
          stablecoin: 0,
          traditionalNote: '~0.4%',
          stablecoinNote: 'No processor',
          highlight: true
        },
        {
          label: 'Per-transaction fees',
          traditional: perTransactionFee,
          stablecoin: 0,
          traditionalNote: '$0.25 each',
          stablecoinNote: 'None',
          highlight: true
        },
        {
          label: 'PCI compliance',
          traditional: pciCompliance,
          stablecoin: 0,
          traditionalNote: 'Annual audit',
          stablecoinNote: 'No card data',
          highlight: true
        },
        {
          label: 'Chargeback fees',
          traditional: chargebackFees,
          stablecoin: 0,
          traditionalNote: `$20 × ${yearlyChargebacks} disputes`,
          stablecoinNote: 'Escrow, not chargebacks',
          highlight: true
        },
        {
          label: 'Fraud losses',
          traditional: fraudLosses,
          stablecoin: 0,
          traditionalNote: '~0.5% CNP fraud',
          stablecoinNote: 'No stolen card numbers',
          highlight: true
        },
        {
          label: 'Settlement delay cost',
          traditional: floatCost,
          stablecoin: 0,
          traditionalNote: '2-3 day float',
          stablecoinNote: 'Instant settlement',
          highlight: true
        },
        {
          label: 'Gas fees',
          traditional: 0,
          stablecoin: 0,
          traditionalNote: 'N/A',
          stablecoinNote: 'Covered',
          highlight: false
        },
      ],
      traditionalTotal,
      traditionalPercent,
      stablecoinTotal,
      stablecoinPercent,
      annualSavings,
      savingsPercent,
      currentProfit,
      profitIncrease,
      newProfit
    };
  }, [monthlyVolume, avgTransaction, chargebackRate, profitMargin]);

  const formatCurrency = (num: number): string => {
    if (num === 0) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatPercent = (num: number): string => num.toFixed(2) + '%';

  return (
    <>
      <SEO
        title="Merchant Savings Calculator - Compare Card vs Stablecoin Payment Costs"
        description="Calculate how much you can save by accepting stablecoin payments instead of traditional card payments. Compare interchange fees, network fees, chargeback costs, and more."
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "Merchant Savings Calculator",
          "description": "Interactive calculator comparing traditional card payment costs vs stablecoin escrow payment costs for online merchants",
          "applicationCategory": "FinanceApplication",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          }
        }}
      />

      <div style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#e8e8e8',
        fontFamily: "'IBM Plex Mono', monospace",
        padding: '40px 20px',
        margin: '-2rem -1rem'
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap');

          input[type="range"] {
            -webkit-appearance: none;
            width: 100%;
            height: 4px;
            background: #333;
            border-radius: 2px;
            outline: none;
          }

          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            background: #00ff88;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
          }

          input[type="range"]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            background: #00ff88;
            border-radius: 50%;
            cursor: pointer;
            border: none;
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
          }

          .calculator-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
          }

          @media (max-width: 968px) {
            .calculator-grid {
              grid-template-columns: 1fr;
            }

            .mobile-scroll {
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
            }

            .mobile-text-sm {
              font-size: 0.9rem !important;
            }

            .mobile-padding-sm {
              padding: 10px 15px !important;
            }
          }

          @media (max-width: 640px) {
            .comparison-table {
              font-size: 0.85rem;
            }

            .comparison-table-value {
              font-size: 1.1rem !important;
            }

            .savings-title {
              font-size: 2rem !important;
            }

            .page-header h1 {
              font-size: 2rem !important;
            }

            .input-field {
              font-size: 1.2rem !important;
              padding: 10px 14px !important;
            }

            .result-box {
              padding: 20px !important;
            }
          }
        `}</style>

        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <header className="page-header" style={{ marginBottom: '50px' }}>
            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '2.5rem',
              fontWeight: 700,
              margin: 0,
              letterSpacing: '-1px'
            }}>
              Payment Cost Calculator
            </h1>
            <p style={{
              color: '#666',
              fontSize: '0.9rem',
              marginTop: '10px'
            }}>
              See what you're really paying for
            </p>
          </header>

          {/* Inputs and Results Side-by-Side */}
          <div className="calculator-grid" style={{
            marginBottom: '50px'
          }}>
            {/* Left: Inputs */}
            <div style={{
              padding: '30px',
              background: '#111',
              borderRadius: '12px',
              border: '1px solid #222',
              display: 'flex',
              flexDirection: 'column',
              gap: '30px'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Monthly Card Volume
                  </span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={monthlyVolume === 0 ? '' : formatCurrency(monthlyVolume)}
                  placeholder="$0"
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setMonthlyVolume(val ? Number(val) : 0);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#00ff88',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                    marginBottom: '10px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00ff88'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
                <input
                  type="range"
                  min="1000"
                  max="50000000"
                  step="10000"
                  value={Math.min(monthlyVolume, 50000000)}
                  onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                />
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>
                  Slider: $1k - $50M (type for higher amounts)
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Average Transaction
                  </span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={avgTransaction === 0 ? '' : formatCurrency(avgTransaction)}
                  placeholder="$0"
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setAvgTransaction(val ? Number(val) : 0);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#00ff88',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                    marginBottom: '10px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00ff88'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
                <input
                  type="range"
                  min="10"
                  max="5000"
                  step="10"
                  value={Math.min(avgTransaction, 5000)}
                  onChange={(e) => setAvgTransaction(Number(e.target.value))}
                />
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>
                  Slider: $10 - $5k (type for higher amounts)
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Chargeback Rate
                  </span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={chargebackRate === 0 ? '' : `${chargebackRate}%`}
                  placeholder="0%"
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setChargebackRate(val ? Number(val) : 0);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#00ff88',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                    marginBottom: '10px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00ff88'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={Math.min(chargebackRate, 5)}
                  onChange={(e) => setChargebackRate(Number(e.target.value))}
                />
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>
                  Slider: 0% - 5% (type for higher rates)
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Profit Margin (optional)
                  </span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={profitMargin ? `${profitMargin}%` : ''}
                  placeholder="0%"
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setProfitMargin(val ? Number(val) : null);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: profitMargin ? '#00ff88' : '#666',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                    marginBottom: '10px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00ff88'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  value={profitMargin || 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setProfitMargin(val === 0 ? null : val);
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>
                  Slider: 0% - 50% (type for higher margins)
                </div>
              </div>
            </div>

            {/* Right: Key Results */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Annual Savings */}
              <div className="result-box" style={{
                background: 'linear-gradient(135deg, #001a0d 0%, #0a0a0a 100%)',
                borderRadius: '12px',
                border: '2px solid #00ff88',
                padding: '30px',
                textAlign: 'center',
                boxShadow: '0 0 60px rgba(0, 255, 136, 0.1)',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <div style={{
                  color: '#00ff88',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  marginBottom: '10px'
                }}>
                  Annual Savings
                </div>
                <div className="savings-title" style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '3rem',
                  fontWeight: 700,
                  color: '#00ff88',
                  textShadow: '0 0 40px rgba(0, 255, 136, 0.5)',
                  marginBottom: '5px'
                }}>
                  {formatCurrency(calculations.annualSavings)}
                </div>
                <div style={{
                  color: '#888',
                  fontSize: '0.9rem'
                }}>
                  {formatPercent(calculations.savingsPercent)} less than cards
                </div>

                {calculations.currentProfit && (
                  <div style={{
                    marginTop: '20px',
                    paddingTop: '20px',
                    borderTop: '1px solid #1a3d2a'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '15px',
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ color: '#666', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                          Current Profit
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#888' }}>
                          {formatCurrency(calculations.currentProfit)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#666', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                          New Profit
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#00ff88' }}>
                          {formatCurrency(calculations.newProfit!)}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ color: '#666', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                        Profit Increase
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#00ff88' }}>
                        +{formatPercent(calculations.profitIncrease!)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div style={{
                background: '#111',
                borderRadius: '12px',
                border: '1px solid #222',
                padding: '20px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px'
              }}>
                <div>
                  <div style={{ color: '#666', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                    Card Processing
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#ff4444' }}>
                    {formatCurrency(calculations.traditionalTotal)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>
                    {formatPercent(calculations.traditionalPercent)} of volume
                  </div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                    Stablecoin
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#00ff88' }}>
                    {formatCurrency(calculations.stablecoinTotal)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>
                    {formatPercent(calculations.stablecoinPercent)} of volume
                  </div>
                </div>
              </div>

              {/* Partial Adoption */}
              <div style={{
                background: '#111',
                borderRadius: '12px',
                border: '1px solid #222',
                padding: '15px 20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '5px' }}>
                  Even with just 5% adoption
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#00ff88' }}>
                  {formatCurrency(calculations.annualSavings * 0.05)}/year saved
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-side comparison table */}
          <div className="mobile-scroll" style={{
            background: '#111',
            borderRadius: '12px',
            border: '1px solid #222',
            overflow: 'hidden',
            marginBottom: '40px'
          }}>
            <div className="comparison-table" style={{ minWidth: '600px' }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              background: '#1a1a1a',
              borderBottom: '1px solid #333'
            }}>
              <div style={{ padding: '15px 20px' }}>
                <span style={{
                  color: '#666',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Cost Category
                </span>
              </div>
              <div style={{
                padding: '15px 20px',
                textAlign: 'right',
                borderLeft: '1px solid #333'
              }}>
                <span style={{
                  color: '#ff4444',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600
                }}>
                  Card Payment
                </span>
              </div>
              <div style={{
                padding: '15px 20px',
                textAlign: 'right',
                borderLeft: '1px solid #333'
              }}>
                <span style={{
                  color: '#00ff88',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600
                }}>
                  Stablecoin
                </span>
              </div>
            </div>

            {/* Rows */}
            {calculations.rows.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  borderBottom: i < calculations.rows.length - 1 ? '1px solid #222' : 'none',
                  background: row.highlight && row.traditional > 0 ? 'rgba(255, 68, 68, 0.03)' : 'transparent'
                }}
              >
                <div style={{ padding: '12px 20px' }}>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>{row.label}</div>
                </div>
                <div style={{
                  padding: '12px 20px',
                  textAlign: 'right',
                  borderLeft: '1px solid #222'
                }}>
                  <div style={{
                    fontWeight: 600,
                    color: row.traditional > 0 ? '#ff4444' : '#444'
                  }}>
                    {formatCurrency(row.traditional)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                    {row.traditionalNote}
                  </div>
                </div>
                <div style={{
                  padding: '12px 20px',
                  textAlign: 'right',
                  borderLeft: '1px solid #222'
                }}>
                  <div style={{
                    fontWeight: 600,
                    color: row.stablecoin > 0 ? '#e8e8e8' : '#00ff88'
                  }}>
                    {formatCurrency(row.stablecoin)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                    {row.stablecoinNote}
                  </div>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              background: '#1a1a1a',
              borderTop: '2px solid #333'
            }}>
              <div style={{ padding: '20px' }}>
                <span style={{
                  fontWeight: 600,
                  fontSize: '1rem'
                }}>
                  Annual Total
                </span>
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                  on {formatCurrency(calculations.yearlyVolume)} volume
                </div>
              </div>
              <div style={{
                padding: '20px',
                textAlign: 'right',
                borderLeft: '1px solid #333'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#ff4444'
                }}>
                  {formatCurrency(calculations.traditionalTotal)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  {formatPercent(calculations.traditionalPercent)} of volume
                </div>
              </div>
              <div style={{
                padding: '20px',
                textAlign: 'right',
                borderLeft: '1px solid #333'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#00ff88'
                }}>
                  {formatCurrency(calculations.stablecoinTotal)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  {formatPercent(calculations.stablecoinPercent)} of volume
                </div>
              </div>
            </div>
            </div>
          </div>

          <footer style={{
            marginTop: '50px',
            padding: '20px',
            borderTop: '1px solid #222',
            color: '#555',
            fontSize: '0.7rem',
            lineHeight: 1.6
          }}>
            <p style={{ margin: 0 }}>
              Estimates based on typical e-commerce card-not-present rates. Actual costs vary by merchant category,
              processor, and card mix. Traditional costs assume: interchange (~2%), network fees (0.14%),
              processor markup (0.4%), per-transaction fees ($0.25), PCI compliance ($300/yr),
              chargeback fees ($20 each), estimated fraud losses (0.5% of volume), and opportunity cost
              of 3-day settlement float at 8% annual rate.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
