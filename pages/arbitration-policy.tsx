import Layout from '@/components/layout/Layout'

export default function ArbitrationPolicy() {
  return (
    <Layout children={
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Instant Escrow Auto-Arbitration System</h1>
            <p className="text-lg text-gray-600 mb-8 italic">How Disputes Work - For Buyers and Sellers</p>
            
            <div className="prose prose-lg max-w-none">
              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Overview</h2>
                <p className="text-gray-600 mb-2">
                  Our auto-arbitration system empowers buyers and sellers to resolve disputes directly. <strong>Once funds are in dispute, they're frozen until both parties agree on a refund amount.</strong> The system automatically executes the agreed resolution without requiring admin intervention.
                </p>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">How the Auto-Arbitration System Works</h2>
                
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-gray-700">
                      <strong>Key Innovation:</strong> When both parties enter the same refund amount, the dispute automatically resolves and distributes funds accordingly. No waiting for admin decisions.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Step-by-Step Process</h3>
                    <ol className="list-decimal list-inside text-gray-600 space-y-2">
                      <li><strong>Buyer raises dispute</strong> - Enters a comment explaining the issue and suggests a refund amount</li>
                      <li><strong>Seller gets notified</strong> - Receives email alert about the dispute</li>
                      <li><strong>Both parties negotiate</strong> - Through the dashboard, each can:
                        <ul className="list-disc list-inside ml-6 mt-1">
                          <li>View all comments and refund suggestions history</li>
                          <li>Add new comments to explain their position</li>
                          <li>Submit refund amount proposals</li>
                        </ul>
                      </li>
                      <li><strong>Automatic resolution</strong> - When both enter the same amount, funds distribute instantly</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Understanding Refund Amounts</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Refund amount</strong> = How much goes back to the buyer</li>
                      <li><strong>Remaining amount</strong> = Automatically goes to the seller</li>
                      <li><strong>Example:</strong> On a $100 contract, agreeing on $30 refund means buyer gets $30, seller gets $70</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">When to Raise a Dispute</h2>
                
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Common Reasons for Buyers</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    <li><strong>Non-delivery</strong> - Item never arrived (suggest 100% refund)</li>
                    <li><strong>Wrong item</strong> - Received something different (negotiate partial or full refund)</li>
                    <li><strong>Quality issues</strong> - Item not as described (negotiate appropriate compensation)</li>
                    <li><strong>Seller unresponsive</strong> - No communication after payment (start with 100% refund request)</li>
                    <li><strong>Accidental payment</strong> - Made an error (request 100% refund with explanation)</li>
                  </ul>
                </div>

                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">How Sellers Should Respond</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    <li><strong>Legitimate issues</strong> - Agree to appropriate refund amount quickly</li>
                    <li><strong>Delivery completed</strong> - Provide tracking info in comments, suggest 0% refund</li>
                    <li><strong>Partial fault</strong> - Propose partial refund that's fair to both parties</li>
                    <li><strong>Buyer error</strong> - Explain in comments but consider goodwill partial refund</li>
                  </ul>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-gray-700">
                    <strong>Pro Tip:</strong> Starting with reasonable proposals speeds resolution. Extreme positions may prolong negotiations.
                  </p>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Managing Your Dispute</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Through Your Dashboard</h3>
                    <p className="text-gray-600 mb-2">Click "Manage Dispute" on any disputed contract to:</p>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>View history</strong> - See all previous comments and refund suggestions from both parties</li>
                      <li><strong>Add comments</strong> - Explain your position, provide evidence, respond to the other party</li>
                      <li><strong>Propose refund amount</strong> - Enter what you think is fair (can be updated anytime)</li>
                      <li><strong>Track progress</strong> - See how close you are to agreement</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Negotiation Tips</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Be specific</strong> - Clearly explain why you're suggesting your refund amount</li>
                      <li><strong>Provide evidence</strong> - Reference tracking numbers, photos, or communications</li>
                      <li><strong>Stay professional</strong> - Constructive dialogue leads to faster resolution</li>
                      <li><strong>Consider compromise</strong> - Meeting in the middle often works for both parties</li>
                      <li><strong>Update proposals</strong> - You can change your refund suggestion anytime before agreement</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Common Dispute Scenarios and Resolutions</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Item Never Delivered</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Buyer action:</strong> Raise dispute with 100% refund request, explain non-delivery</li>
                      <li><strong>Seller with proof:</strong> Share tracking in comments, propose 0% refund</li>
                      <li><strong>Seller without proof:</strong> Accept 100% refund to resolve quickly</li>
                      <li><strong>Typical outcome:</strong> 100% refund if no delivery proof exists</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Wrong or Damaged Item</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Buyer action:</strong> Explain issue, suggest refund based on item's value/condition</li>
                      <li><strong>Seller options:</strong> Offer full refund with return, or partial refund to keep item</li>
                      <li><strong>Negotiation:</strong> Discuss return shipping costs and item value</li>
                      <li><strong>Typical outcome:</strong> 50-100% refund depending on severity</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Quality Disputes</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Buyer action:</strong> Detail quality issues, propose partial refund</li>
                      <li><strong>Seller response:</strong> Evaluate claim, counter with fair adjustment</li>
                      <li><strong>Resolution path:</strong> Often settle on 10-30% refund for minor issues</li>
                      <li><strong>Alternative:</strong> Full refund upon return if quality is unacceptable</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Accidental Purchase</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Buyer action:</strong> Immediately dispute with 100% refund, explain the error</li>
                      <li><strong>Seller consideration:</strong> If not shipped, agreeing to full refund is reasonable</li>
                      <li><strong>If already shipped:</strong> Negotiate return process or partial refund</li>
                      <li><strong>Typical outcome:</strong> 100% if caught early, negotiated if shipped</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">What If We Can't Agree?</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Funds Remain Frozen</h3>
                    <p className="text-gray-600">
                      If you can't reach agreement, funds stay frozen indefinitely. Neither party can access them until you both enter the same refund amount. This motivates finding a reasonable compromise.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">External Arbitration Option</h3>
                    <p className="text-gray-600 mb-2">
                      For high-value disputes where agreement seems impossible, you can jointly choose to use a professional arbitration service. This is entirely separate from our platform:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Both parties agree to use external arbitration</li>
                      <li>Select and pay for arbitration service together</li>
                      <li>Arbitrator reviews evidence and makes decision</li>
                      <li>Both parties then enter the arbitrator's decided refund amount</li>
                      <li>System automatically executes the resolution</li>
                    </ul>
                    
                    <div className="p-4 bg-amber-50 rounded-lg mt-2">
                      <p className="text-gray-700 text-sm">
                        <strong>Note:</strong> External arbitration is rarely needed. Most disputes resolve through direct negotiation as both parties have incentive to reach agreement and unlock the funds.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Admin Support</h3>
                    <p className="text-gray-600">
                      While admins don't make allocation decisions in the auto-arbitration system, they can:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Help facilitate communication if one party is unresponsive</li>
                      <li>Provide guidance on using the dispute management features</li>
                      <li>Assist with technical issues accessing the platform</li>
                      <li>Execute resolutions in special circumstances (both parties email agreeing to specific allocation)</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Best Practices for Quick Resolution</h2>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">For Buyers</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Raise disputes promptly when issues arise</li>
                      <li>Clearly explain the problem in your initial comment</li>
                      <li>Start with a reasonable refund request</li>
                      <li>Provide evidence (order details, photos, etc.)</li>
                      <li>Be willing to compromise for partial issues</li>
                      <li>Respond promptly to seller's proposals</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">For Sellers</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Respond to disputes within 24 hours</li>
                      <li>Provide delivery proof when available</li>
                      <li>Acknowledge legitimate issues honestly</li>
                      <li>Make fair counter-offers quickly</li>
                      <li>Consider customer satisfaction and reputation</li>
                      <li>Document your shipping and handling process</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg mt-4">
                  <p className="text-gray-700">
                    <strong>Remember:</strong> The faster you reach agreement, the sooner funds are released. Both parties benefit from quick, fair resolution.
                  </p>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Preventing Disputes</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Clear Communication</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li><strong>Sellers:</strong> Provide detailed, accurate descriptions</li>
                      <li><strong>Buyers:</strong> Ask questions before funding contracts</li>
                      <li><strong>Both:</strong> Confirm delivery addresses and timelines</li>
                      <li><strong>Both:</strong> Document agreements about quality standards</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Proper Documentation</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      <li>Save product descriptions and photos</li>
                      <li>Keep shipping receipts and tracking numbers</li>
                      <li>Screenshot important communications</li>
                      <li>Photo items before shipping (sellers)</li>
                      <li>Photo items upon receipt (buyers)</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Contact Information</h2>
                <div className="space-y-2 text-gray-600">
                  <p>
                    <strong>Technical Support:</strong> info@instantescrow.nz<br/>
                    <strong>Platform Issues:</strong> Include contract reference number and description of the problem
                  </p>
                  <p>
                    <strong>Note:</strong> Support staff cannot make dispute allocation decisions - resolutions must come from mutual agreement through the auto-arbitration system.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    } />
  )
}