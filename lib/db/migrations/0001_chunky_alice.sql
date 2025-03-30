CREATE TABLE `Invoice` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`customerName` text NOT NULL,
	`vendorName` text NOT NULL,
	`invoiceNumber` text NOT NULL,
	`invoiceDate` integer NOT NULL,
	`dueDate` integer,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'USD',
	`status` text DEFAULT 'processed' NOT NULL,
	`filePath` text,
	`fileType` text,
	`fileSize` integer,
	`tokensUsed` integer,
	`tokensCost` real,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `LineItem` (
	`id` text PRIMARY KEY NOT NULL,
	`invoiceId` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real,
	`unitPrice` real,
	`amount` real NOT NULL,
	`productCode` text,
	`taxRate` real,
	`metadata` blob,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON UPDATE no action ON DELETE cascade
);
