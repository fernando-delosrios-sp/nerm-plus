# SailPoint Non-Employee Risk Management+

## Changelog

-   0.1.0 (2024-12-24):
    -   Initial draft

## Introduction

This is an SaaS connector for SailPoint Non-Employee Risk Management. It was built to address most common integration challenges based on my experience. The most significant features of this connector are:

-   Full provisioning support for profiles, users and portal users.
-   Seamless combined profile/user management (i.e. manage a People profile and its associated user as a single account).
-   Run custom NERM workflows on account operations (e.g. run Terminate Assignment workflow upon disable operation).
-   Trigger workflow executions on ephemeral access requests (i.e. request access profile with workflow entitlement that runs on provisioning, but it doesn't assign the entitlement).
-   Manage user roles as entitlements.
-   Manage associated profiles as entitlements (e.g. add/remove locations to an assignment as ISC entitlements).
-   Profile attribute traversing (e.g. read all job titles of a People profile's assignments).
-   Dynamic multi-valued attribute management (i.e. the connector concatenates values if multiple are found and the attribute is not multi-valued).
-   Optional push mode (i.e. push search results to NERM and persist them as profiles, with the ability of keeping nesting relationships like roles to entitlements).
