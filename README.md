Record Spend

A personal spending, budgeting and cashflow tracker.

Record Spend is a mobile-friendly web app designed to track everyday spending, manage bank and credit-card balances, and assess whether planned income can comfortably support expected expenditure.

Features

* Transactions: Record purchases, income, refunds and transfers.
* Accounts: Track a current account, savings accounts and a credit card.
* Recurring transactions: Manage regular payments, income and transfers.
* Monthly budgets: Set spending allowances for individual categories.
* Annual provisions: Set aside notional monthly amounts for annual bills and irregular expenditure, with carry-forward balances.
* Budgeted Monthly Surplus: Compare expected monthly income against all monthly budgets and provisions.
* Cashflow forecasting: View projected balances, spending and a rolling 12-month budget outlook.
* Provision calculation trace: Expand individual forecast months to see how provision contributions, payments and balances are calculated.
* Data management: Export transactions to CSV and back up or restore records using JSON.

How budgeting works

Record Spend distinguishes between actual financial activity and planned expenditure.

Budgeted Monthly Surplus = Expected Monthly Income − Monthly Budgets − Monthly Provisions

Monthly budgets assume the full allowance is spent. Annual provisions account for expected expenditure that occurs less frequently, whether scheduled or irregular.

These planning figures are separate from actual transactions and account balances.

Installation

Record Spend is a Progressive Web App (PWA), hosted using GitHub Pages. It can be opened in a browser or added to an iPhone Home Screen for an app-like experience.

Data and backups

Financial records are stored locally on the device using IndexedDB, rather than in a cloud account.

Important: Regularly export a JSON backup, particularly before updating the app. Browser and Home Screen installations may have separate local data stores. Removing the app or clearing website data may permanently delete records that have not been backed up.

Version Record Spend 2.0 — v23

Personal project, developed and refined through practical use.
