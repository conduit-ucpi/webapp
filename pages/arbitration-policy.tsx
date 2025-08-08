import Layout from '@/components/layout/Layout'

export default function ArbitrationPolicy() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Conduit-UCPI Dispute Resolution Guide</h1>
            <p className="text-lg text-gray-600 mb-8 italic">For Users and Administrative Staff</p>
            
            <div className="prose prose-lg max-w-none">
              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Overview</h2>
                <p className="text-gray-600 mb-2">
                  Disputes exist to protect both parties when transactions go wrong. <strong>Once funds are in dispute, they're frozen until resolution - no one can access them.</strong> The admin team facilitates communication and executes agreements reached between disputing parties, but does not make allocation decisions.
                </p>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">When to Dispute</h2>
                
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">For Buyers</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    <li><strong>Item never arrived</strong></li>
                    <li><strong>Item significantly different</strong> from description</li>
                    <li><strong>Seller unresponsive</strong> after payment but before expiry</li>
                    <li><strong>You made an error</strong> (wrong amount, wrong contract)</li>
                  </ul>
                </div>

                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">For Sellers</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    <li><strong>Buyer claims non-delivery</strong> but you have proof of delivery</li>
                    <li><strong>Buyer wants refund</strong> for delivered, correctly described item</li>
                    <li><strong>False quality claims</strong> on items delivered as described</li>
                  </ul>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-gray-700">
                    <strong>Key Point:</strong> Disputes freeze funds immediately. Don't wait if you have a legitimate concern.
                  </p>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">What Happens When You Dispute</h2>
                <ol className="list-decimal list-inside text-gray-600 space-y-2">
                  <li><strong>Immediate freeze</strong> - Funds cannot be accessed by anyone</li>
                  <li><strong>Both parties notified</strong> via email with dispute reference number</li>
                  <li><strong>Parties communicate directly</strong> to resolve the issue</li>
                  <li><strong>Agreement reached</strong> between buyer and seller</li>
                  <li><strong>Both parties notify admin</strong> of agreed allocation</li>
                  <li><strong>Funds released</strong> according to the agreement</li>
                </ol>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">The Dispute Resolution Process</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Step 1: Funds Are Frozen</h3>
                    <p className="text-gray-600">
                      Once disputed, funds remain frozen until both parties agree on allocation. <strong>There is no time limit</strong> - funds can remain frozen indefinitely until an agreement is reached.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Step 2: Direct Resolution Between Parties</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Buyer and seller communicate directly to resolve the dispute</li>
                      <li>They can negotiate any solution they both find acceptable</li>
                      <li>Common resolutions include: full refund, partial refund, return process, or full payment to seller</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Step 3: Professional Arbitration (If Needed)</h3>
                    <p className="text-gray-600 mb-2">
                      If parties cannot reach agreement, we recommend using a professional arbitration service. This is <strong>entirely separate from our platform</strong> - parties arrange and pay for arbitration themselves.
                    </p>
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <p className="text-gray-700 text-sm">
                        <strong>Important Context:</strong> Professional arbitration is only needed in extreme cases where parties genuinely cannot agree. This is the same situation you'd face with any payment method - credit cards, PayPal, bank transfers - except with those methods, you'd be trying to recover money the seller may have already spent. With our system, the disputed funds remain safely frozen until resolution.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Step 4: Notifying Admin of Resolution</h3>
                    <p className="text-gray-600 mb-2">
                      Once parties reach agreement (either directly or through arbitration), both parties should email the admin team stating the agreed allocation:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Email:</strong> disputes@conduit-ucpi.com</li>
                      <li><strong>Include:</strong> Contract reference number and agreed fund allocation</li>
                      <li><strong>From:</strong> Both parties (can be separate emails or joint email)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Step 5: Unresponsive Party Protocol</h3>
                    <p className="text-gray-600 mb-2">If only one party emails the admin team:</p>
                    <ol className="list-decimal list-inside text-gray-600 space-y-1">
                      <li>Admin contacts the other party</li>
                      <li>One week response window provided</li>
                      <li>If no response after one week, funds allocated per the responsive party's instruction</li>
                      <li>Both parties notified of intended action before execution</li>
                    </ol>
                    <div className="p-4 bg-green-50 rounded-lg mt-2">
                      <p className="text-gray-700 text-sm">
                        <strong>Note:</strong> In scam situations, sellers typically become unresponsive after taking payment. When buyers dispute non-delivery and the seller doesn't respond to admin contact, the buyer will receive their funds back under this protocol.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">What Admin Does and Doesn't Do</h2>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Admin Will:</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Freeze funds immediately when dispute is raised</li>
                      <li>Facilitate initial communication between parties</li>
                      <li>Execute fund allocation based on agreements reached by parties</li>
                      <li>Apply one-week rule for unresponsive parties</li>
                      <li>Provide dispute reference numbers for tracking</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Admin Will NOT:</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Decide who is right or wrong</li>
                      <li>Investigate delivery claims</li>
                      <li>Determine if items match descriptions</li>
                      <li>Provide legal advice or arbitration services</li>
                      <li>Force parties to accept specific resolutions</li>
                      <li>Make judgment calls on ambiguous situations</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Common Dispute Scenarios</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Non-Delivery Claims</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Parties should exchange:</strong> Tracking information, delivery addresses, shipping receipts</li>
                      <li><strong>Common resolution:</strong> If no delivery proof, buyer gets refund</li>
                      <li><strong>Alternative:</strong> Seller provides replacement or extended delivery time</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Wrong Item Delivered</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Parties should exchange:</strong> Photos, original descriptions, communication logs</li>
                      <li><strong>Common resolution:</strong> Return process where buyer ships back item, then receives refund</li>
                      <li><strong>Alternative:</strong> Partial refund if item has some value to buyer</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Item "Not as Described"</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Parties should discuss:</strong> Objective differences vs subjective preferences</li>
                      <li><strong>Common resolution:</strong> Return process or partial refund based on degree of difference</li>
                      <li><strong>Escalation:</strong> Professional arbitration for high-value or complex technical disputes</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Communication Breakdown</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Admin facilitates:</strong> Initial contact between parties</li>
                      <li><strong>Parties negotiate:</strong> Reasonable communication expectations and resolution</li>
                      <li><strong>Common resolution:</strong> Good faith effort to complete transaction or full refund</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Evidence and Documentation</h2>
                <p className="text-gray-600 mb-4">
                  While admin doesn't evaluate evidence, parties typically find these helpful in reaching agreements:
                </p>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Strong Supporting Information</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Tracking numbers</strong> with delivery confirmation</li>
                      <li><strong>Photos of packaging/shipping process</strong></li>
                      <li><strong>Screenshots of original item descriptions</strong></li>
                      <li><strong>Communication logs</strong> showing responsiveness</li>
                      <li><strong>Return shipping receipts</strong></li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Less Helpful Information</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Subjective quality complaints without clear standards</li>
                      <li>Claims about verbal agreements not documented</li>
                      <li>Arguments about "reasonable" expectations without prior agreement</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Professional Arbitration</h2>
                <p className="text-gray-600 mb-4">
                  For complex or high-value disputes where parties cannot agree:
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">When to Consider Arbitration</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>High-value transactions (typically $500+)</li>
                      <li>Complex technical products requiring specialist knowledge</li>
                      <li>Parties genuinely cannot reach agreement after good faith negotiation</li>
                    </ul>
                    
                    <div className="p-4 bg-blue-50 rounded-lg mt-2">
                      <p className="text-gray-700 text-sm">
                        <strong>Reality Check:</strong> Most disputes resolve through direct communication. Professional arbitration is rare and typically only necessary for the same types of complex commercial disputes that would require legal intervention with any payment method. The key difference is that with traditional payments, you'd be pursuing arbitration while trying to recover money from someone who may have already spent it - our system keeps those funds secure during the process.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Arbitration Process</h3>
                    <ol className="list-decimal list-inside text-gray-600 space-y-1">
                      <li>Parties select and contact arbitration service</li>
                      <li>Parties arrange and pay for arbitration</li>
                      <li>Arbitrator makes binding decision</li>
                      <li>Both parties email admin with arbitration outcome</li>
                      <li>Admin executes allocation per arbitration decision</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Arbitration Costs</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Parties arrange and pay for arbitration services directly</li>
                      <li>Arbitration costs are not covered by Conduit-UCPI</li>
                      <li>Costs typically split between parties unless arbitrator decides otherwise</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Timeline Expectations</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Immediate Actions</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Dispute filing:</strong> Funds frozen instantly</li>
                      <li><strong>Initial notification:</strong> Both parties notified within minutes</li>
                      <li><strong>Admin response:</strong> Unresponsive party contacted within 24 hours</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Resolution Timelines</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Direct negotiation:</strong> No time limit - depends entirely on parties</li>
                      <li><strong>Admin execution:</strong> Funds released within 24 hours of receiving agreement</li>
                      <li><strong>Unresponsive party rule:</strong> One week maximum wait time</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Fixed Deadlines</h3>
                    <p className="text-gray-600">
                      <strong>Important:</strong> There are no deadlines for reaching agreement. Funds can remain frozen indefinitely until parties resolve their dispute or use arbitration.
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Special Situations</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">International Transactions</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Extended shipping times should be considered in original agreement</li>
                      <li>Different legal systems may require professional arbitration</li>
                      <li>Currency conversion issues are between parties to resolve</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">High-Value Items</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Professional arbitration strongly recommended for disputes over $500</li>
                      <li>Document everything meticulously from the start</li>
                      <li>Consider escrow insurance for very high-value transactions</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Security Concerns</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Account compromise or fraud concerns get expedited admin attention</li>
                      <li>Security-related disputes processed within 24 hours</li>
                      <li>Report suspected fraud immediately to disputes@conduit-ucpi.com</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Best Practices for Dispute Prevention</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">For All Users</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Detailed descriptions</strong> prevent misunderstandings</li>
                      <li><strong>Clear delivery timeframes</strong> set proper expectations</li>
                      <li><strong>Good communication</strong> resolves most issues before disputes</li>
                      <li><strong>Reasonable expiry dates</strong> allow adequate delivery time</li>
                      <li><strong>Document agreements</strong> about quality standards, delivery methods, etc.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">For Sellers</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Use tracking</strong> for all shipments</li>
                      <li><strong>Photo your packaging process</strong></li>
                      <li><strong>Respond to buyer communications promptly</strong></li>
                      <li><strong>Be accurate</strong> in item descriptions</li>
                      <li><strong>Set realistic delivery timeframes</strong></li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">For Buyers</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Ask questions</strong> before funding contracts</li>
                      <li><strong>Verify seller contact information</strong></li>
                      <li><strong>Understand what you're agreeing to</strong></li>
                      <li><strong>Don't fund if descriptions are unclear</strong></li>
                      <li><strong>Save screenshots</strong> of original listings</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Contact Information</h2>
                <div className="space-y-2 text-gray-600">
                  <p>
                    <strong>Dispute Notifications:</strong> disputes@conduit-ucpi.com<br/>
                    <strong>Include:</strong> Contract reference number, brief summary, contact information for both parties
                  </p>
                  <p>
                    <strong>Security/Fraud Emergencies:</strong> Same email with "URGENT SECURITY" in subject line
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}