## Checkout channel enable reports whether it turned the channel on

- Surfaces: orm, workers
- Change: `BillingCheckoutChannelService.enableIfDisabled` reads the id TypeORM returns from a Postgres `UPDATE ... RETURNING`. The enable command's `changed` log matches whether that update turned a disabled channel on.
- Who notices: operators running the billing checkout-channel enable command

## Popularity and terms gates keep the choice under the explanation

- Surfaces: web
- Change: On the popularity-tracking gate and the terms gate, How It Works and View
  Terms of Service open above the choice buttons. The terms date sits under that
  disclosure title.
- Who notices: someone deciding on Popularity Tracking, or accepting updated terms, on
  the website
