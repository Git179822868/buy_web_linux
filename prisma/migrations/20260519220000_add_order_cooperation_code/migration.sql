-- Add a structured cooperation code field for service orders.
ALTER TABLE `orders` ADD COLUMN `cooperationCode` VARCHAR(80) NULL;
