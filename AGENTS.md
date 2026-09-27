<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## MoveYourWay365
- Conversation flow is a client state machine in src/routes/index.tsx; AI only writes short reactions and picks plans — keeps the Aashray voice short and predictable.
- Places/geocoding go through the Google Maps gateway in src/lib/places.server.ts; locations rounded to ~1 km — privacy requirement.
- A curation row is inserted only after a successful Plan A/B/C result; free status = zero rows for the device_id — never charge/count failures.
