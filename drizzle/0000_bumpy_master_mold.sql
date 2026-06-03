CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TABLE "channel_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"period" date NOT NULL,
	"channel" text NOT NULL,
	"revenue" numeric(12, 2),
	"percentage" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "data_pipeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"source" text,
	"status" text NOT NULL,
	"rows_affected" integer,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demand_timeseries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"record_date" date NOT NULL,
	"actual_demand" numeric(12, 2),
	"forecast_demand" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kpi_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"snapshot_date" date NOT NULL,
	"total_revenue" numeric(12, 2),
	"active_products" integer,
	"forecast_accuracy" numeric(5, 2),
	"active_users" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" text NOT NULL,
	"region" text NOT NULL,
	"geom" geometry(point),
	"forecasted_demand" numeric(12, 2),
	"current_stock" numeric(12, 2),
	"confidence" numeric(5, 2),
	"growth_rate" numeric(6, 2),
	"period" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"period" text NOT NULL,
	"dimension" text NOT NULL,
	"value" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "raw_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"date" date NOT NULL,
	"product_id" text,
	"product_name" text NOT NULL,
	"category" text NOT NULL,
	"location" text NOT NULL,
	"sales_channel" text NOT NULL,
	"units_sold" integer NOT NULL,
	"revenue_bdt" numeric(12, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"cost_price" numeric(12, 2) NOT NULL,
	"current_stock" integer NOT NULL,
	"customer_segment" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regional_revenue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"period" date NOT NULL,
	"region" text NOT NULL,
	"revenue" numeric(12, 2),
	"percentage" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"avatar_url" text,
	"plan" text DEFAULT 'free',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "channel_performance" ADD CONSTRAINT "channel_performance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_pipeline_events" ADD CONSTRAINT "data_pipeline_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_timeseries" ADD CONSTRAINT "demand_timeseries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_data" ADD CONSTRAINT "raw_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_revenue" ADD CONSTRAINT "regional_revenue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_forecasts_geom_idx" ON "market_forecasts" USING gist ("geom");