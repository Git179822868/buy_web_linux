ALTER TABLE `payment_records`
  MODIFY `provider` ENUM('MOCK', 'JEEPAY', 'OFFICIAL') NOT NULL;

ALTER TABLE `refund_records`
  MODIFY `provider` ENUM('MOCK', 'JEEPAY', 'OFFICIAL') NOT NULL;
