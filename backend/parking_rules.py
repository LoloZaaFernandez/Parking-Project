"""
Shared business-rule constants for parking exit handling.

This is a fixed business rule set by the owner (not something meant to be
tuned from the UI/.env), so it lives here as a plain constant instead of in
Settings.
"""

# Single source of truth for the exit tolerance window. This same value
# governs two related but distinct mechanisms that must never drift apart:
#
#   (a) Grace period (waiting_manager.py): how long a ticket that was already
#       paid (status='waiting') can wait for the camera to confirm the
#       physical exit before it gets reverted back to 'open' (unpaid).
#
#   (b) Exit cooldown (auto_ticket.py): how long a plate is ignored by the
#       camera right after its exit was confirmed — by ANY path, automatic
#       (camera) or manual (cashier button) — so the car leaving the frame
#       isn't mistaken for a brand-new entry (ghost ticket).
EXIT_TOLERANCE_MINUTES = 5
