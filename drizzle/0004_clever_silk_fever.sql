CREATE TABLE "oidc_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"issuer_url" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"id_token" text,
	"expires_at" timestamp with time zone NOT NULL,
	"nonce" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "recommended_release_group_id" text;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "recommended_release_group_title" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "oidc_issuer_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "oidc_client_id" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "oidc_client_secret" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "oidc_scopes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oidc_subject" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "oidc_tokens" ADD CONSTRAINT "oidc_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;