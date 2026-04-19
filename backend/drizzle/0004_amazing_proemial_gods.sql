CREATE TABLE "support_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "support_agents_name_unique_idx" ON "support_agents" USING btree ("name");--> statement-breakpoint
CREATE INDEX "support_agents_is_active_idx" ON "support_agents" USING btree ("is_active");
--> statement-breakpoint
INSERT INTO "support_agents" ("id", "name", "is_active")
VALUES
	('agt_riya', 'Riya', true),
	('agt_arjun', 'Arjun', true),
	('agt_meera', 'Meera', true),
	('agt_kabir', 'Kabir', true),
	('agt_isha', 'Isha', true),
	('agt_neha', 'Neha', true)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
DO $$
DECLARE
	agent_names text[] := ARRAY['Riya', 'Arjun', 'Meera', 'Kabir', 'Isha', 'Neha'];
	agent_count int := array_length(agent_names, 1);
BEGIN
	WITH targets AS (
		SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn
		FROM "complaints"
		WHERE "assigned_to" IN ('Demo Agent', 'End Customer', 'Demo User')
	)
	UPDATE "complaints" c
	SET "assigned_to" = agent_names[((targets.rn - 1) % agent_count) + 1],
		"updated_at" = now()
	FROM targets
	WHERE c."id" = targets."id";
END $$;
