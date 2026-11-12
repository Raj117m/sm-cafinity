# SM Cafinity owner demonstration

## Start

1. Open `Start-Cafinity.command` on your Mac (Windows: `Start-Cafinity.bat`). Node.js 22.13+ must be installed. Keep the terminal open.
2. Laptop: open http://localhost:4173/staff. Sign in with `owner` / `CafinityOwner!26`. Click Enable Alerts.
3. Phone: connect to the same Wi-Fi and open the LAN address printed in the terminal. Select Table 04, then Experience as a Customer.
4. Optional: laptop /qr → enter that LAN base address → print cards or scan Table 04. Do not put localhost in a phone QR code.

## Present the workflow

| Step | Click | Expected result |
|---|---|---|
| 1 | Customer: add Cappuccino, leave options unchecked, Add to order; repeat; add Grilled Cheese Sandwich | Cart shows 3 items, ₹520 |
| 2 | Review order → Place Order → Cancel within 10 seconds | Cancelled record retained; no preparation or purchase coins |
| 3 | Re-add those items and place another order; wait 10 seconds | Laptop shows Table 04 as NEW, with a visual alert |
| 4 | Staff: Start Preparing → Mark Ready → Mark Served | Customer My Table updates |
| 5 | Staff Ingredients: switch Milk out of stock | Cappuccino and Cold Coffee sold out; Black Coffee remains orderable |
| 6 | Restore Milk | Dependent products return unless another ingredient is unavailable |
| 7 | Customer Games: request UNO | Staff Games shows Table 04 request; click Mark delivered |
| 8 | Staff Games: disable UNO | Customer cannot submit another UNO request; restore after demo |
| 9 | Customer Rewards: select Aarav test account | Balance/history appear; no real SMS is sent |
| 10 | Customer: place another eligible order | It joins the open table bill. Unpaid orders earn no purchase coins |
| 11 | Customer Games: suggest Monopoly | First eligible suggestion adds 5 coins; repeated suggestions do not |
| 12 | Staff Tables & Billing: Table 04 → Record Payment | Combined orders and outstanding amount shown |
| 13 | Select Cash, tick received-payment confirmation, Confirm Payment | Bill PAID; linked test customer earns purchase coins on their own eligible purchases |
| 14 | Close Bill | Bill CLOSED; another order opens a fresh bill |
| 15 | Owner Analytics: This Week → Today → This Month → Download CSV | Actual paid sales, quantities and Excel-compatible export |
| 16 | Refresh phone and laptop | Transactions remain saved |
| 17 | Disconnect staff Wi-Fi briefly; submit an order from another reachable device; reconnect | Reconnecting indicator clears; snapshot restores missed orders |
| 18 | Staff Games: Add game, edit, remove | Changes persist and update customer game menu |

## Verify before presenting to the owner

- Run the complete sequence on the actual phone and laptop. Hardware/network validation was blocked during development, so this checklist is an acceptance test, not a record of completed physical testing.
- Check text and touch targets on the phone, alert audio on the laptop, and QR camera scanning.
- To show redemption, place a later order while signed in, enter available coins in checkout, and observe the discount and ledger reservation. Cancel within the window to show coins returned.
- To show correction, owner Billing → paid bill → Correct / void payment → enter reason. Original record stays visible, earned credits reverse, and bill reopens for corrected collection.
- To reset, sign in as owner, open demo home and choose Reset Demo Data. Type RESET DEMO. This removes demo transaction records; menu edits and staff accounts remain.

All menu prices/products are placeholders. Counter payment uses two steps: Counter order, then Tables & Billing → Record Payment.
