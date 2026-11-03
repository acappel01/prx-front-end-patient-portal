import AuthorizeNetCard from "@/components/payments/gateways/AuthorizeNetCard";
import NmiCard from "@/components/payments/gateways/NmiCard";
import SquareCard from "@/components/payments/gateways/SquareCard";
import StripeCard from "@/components/payments/gateways/StripeCard";

/**
 * One card form per gateway, keyed by `gateway_provider` from
 * the admin's gateway-config (here `GET /patient/memberships/{uuid}/gateway-config`). Each takes `context` and exposes
 * `tokenize({ billing })` through its ref, resolving to `{ token, card }`
 * or throwing an Error whose message is for the card holder.
 *
 * A new gateway is one component here and one gateway class on the server.
 */
export const CARD_FORMS = {
  authorize_net: AuthorizeNetCard,
  nmi: NmiCard,
  stripe: StripeCard,
  square: SquareCard,
};
