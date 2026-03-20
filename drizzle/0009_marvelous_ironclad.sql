CREATE TABLE "oauth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone NOT NULL,
	"scopes" text,
	"client_id" text,
	"client_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_tokens_user_provider" UNIQUE("user_id","provider")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plex_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plex_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "jellyfin_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "jellyfin_api_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "jellyfin_user_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discogs_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discogs_username" text;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;