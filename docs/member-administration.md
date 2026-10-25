# Member administration

Membership table writes stay closed to direct clients. Owners and leaders use the authenticated RPCs:

```js
await supabase.rpc("add_organization_member", {
  target_org: organizationId,
  target_user: authUserId,
  target_role: "contributor",
});

await supabase.rpc("remove_organization_member", {
  target_org: organizationId,
  target_user: authUserId,
});
```

Rules enforced in the database:

- owners and leaders can manage members;
- only owners can assign the leader role or remove an owner;
- owner assignment is not available through this endpoint;
- users cannot remove themselves;
- target users must already exist in Supabase Auth;
- direct membership-table writes remain unavailable to authenticated clients.
