CREATE TABLE "blacklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "blacklist_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "error_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" integer NOT NULL,
	"reported_by" integer NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_offer_id" integer NOT NULL,
	"matched_offer_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"initiator_user_id" integer NOT NULL,
	"counterparty_user_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"amount" double precision NOT NULL,
	"converted_amount" double precision,
	"exchange_rate" double precision,
	"success" boolean NOT NULL,
	"error_reason" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_offer_id" integer NOT NULL,
	"matched_offer_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"telegram_message_id" bigint NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"amount" double precision NOT NULL,
	"amount_currency" text,
	"payment_methods" text DEFAULT '[]' NOT NULL,
	"partial" boolean DEFAULT false NOT NULL,
	"partial_threshold" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_llm_parsed" boolean DEFAULT true NOT NULL,
	"original_message_text" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "referral_codes_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "trust_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"target_user_id" integer NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trusted_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"name" text NOT NULL,
	"link" text,
	"added_from_config" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "trusted_groups_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
CREATE TABLE "user_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"amount" double precision NOT NULL,
	"min_split_amount" double precision NOT NULL,
	"payment_methods" text DEFAULT '{"take":[],"give":[]}' NOT NULL,
	"visibility" text DEFAULT 'friends_and_acquaintances' NOT NULL,
	"visible_to" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notify_on_match" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"username" text,
	"first_name" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"avatar_url" text,
	"notify_on_friend_add" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
ALTER TABLE "error_offers" ADD CONSTRAINT "error_offers_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_offers" ADD CONSTRAINT "error_offers_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_history" ADD CONSTRAINT "exchange_history_user_offer_id_user_offers_id_fk" FOREIGN KEY ("user_offer_id") REFERENCES "public"."user_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_history" ADD CONSTRAINT "exchange_history_matched_offer_id_offers_id_fk" FOREIGN KEY ("matched_offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_history" ADD CONSTRAINT "exchange_history_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_history" ADD CONSTRAINT "exchange_history_initiator_user_id_users_id_fk" FOREIGN KEY ("initiator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_history" ADD CONSTRAINT "exchange_history_counterparty_user_id_users_id_fk" FOREIGN KEY ("counterparty_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_history" ADD CONSTRAINT "exchange_history_group_id_trusted_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."trusted_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_trusted_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."trusted_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_offer_id_user_offers_id_fk" FOREIGN KEY ("user_offer_id") REFERENCES "public"."user_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_matched_offer_id_offers_id_fk" FOREIGN KEY ("matched_offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_requests" ADD CONSTRAINT "offer_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_group_id_trusted_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."trusted_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_relations" ADD CONSTRAINT "trust_relations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_relations" ADD CONSTRAINT "trust_relations_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_offers" ADD CONSTRAINT "user_offers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exchange_history_initiator_idx" ON "exchange_history" USING btree ("initiator_user_id");--> statement-breakpoint
CREATE INDEX "exchange_history_counterparty_idx" ON "exchange_history" USING btree ("counterparty_user_id");--> statement-breakpoint
CREATE INDEX "exchange_history_group_idx" ON "exchange_history" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_member_idx" ON "group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "offer_requests_user_created_idx" ON "offer_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trust_user_target_idx" ON "trust_relations" USING btree ("user_id","target_user_id");