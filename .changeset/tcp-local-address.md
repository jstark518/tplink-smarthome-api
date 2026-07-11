---
'@jstark/tplink-smarthome-api': minor
---

Add `localAddress` and `localPort` to `SendOptions` to bind the outgoing TCP
socket to a specific local interface/port. On a multi-homed host this lets
callers pin which NIC a command is sent from, avoiding `ECONNRESET` when the OS
would otherwise route the connection out of an interface on a different subnet.
TCP only. Closes #1.
