// Two cheaper features that share the same model and the same key as the
// incident assistant, which is exactly why a provider invoice cannot tell
// them apart.

export const CLASSIFIER_SYSTEM = "Classify the alert for the on-call rota. Reply with exactly one word: page, ticket, or ignore.";

export const ALERTS = [
  "disk usage on db-replica-2 /var/lib/postgresql is 91% (threshold 90%), growing 0.4%/hour",
  "checkout-api 5xx ratio 21.5% for 10 minutes (threshold 2%)",
  "certificate for status.example.com expires in 27 days",
  "node pool-a-3f9k memory pressure condition true for 4 minutes",
  "staging-worker-3 CPU 96% for 15 minutes",
  "payment-svc p99 latency 2.4s for 5 minutes (SLO 800ms)",
  "backup job pg-nightly finished with warnings: 2 tables skipped (locked)",
  "kube-apiserver audit log volume 30% above weekly baseline",
  "redis-cache evicted_keys 1200/min (baseline 40/min)",
  "login error ratio 0.3% (threshold 5%)",
  "DNS resolution failures from fra1 pods to api.stripe.com: 14% for 3 minutes",
  "Terraform drift detected in module networking: 1 security group rule changed",
  "dev-env-17 has been idle for 21 days",
  "Kafka consumer group invoices lag 480000 messages and rising",
  "TLS handshake errors on ingress-nginx 0.02% (baseline 0.01%)",
  "orders-db primary replication slot inactive for 50 minutes, WAL retained 38 GB",
  "CI runner queue wait p50 7 minutes (baseline 1 minute)",
  "image scan: 3 new medium CVEs in base image node:22-slim",
  "search-api pod restarted once in the last hour (OOMKilled)",
  "uptime check for docs.example.com failed from 1 of 5 regions",
];

export const SUMMARY_SYSTEM = "Summarise the support thread for the account manager in two sentences: what the customer wants, and what is blocking it.";

export const TICKET = `Thread #88213, customer: Northwind Logistics (Business plan)

[Mon 09:12] Customer: Since Friday our nightly export to S3 has been failing. The job shows "completed" in your dashboard but the bucket only gets an empty manifest file. We rely on this for our finance reconciliation, which runs at 06:00.
[Mon 09:40] Support (Ana): Thanks, I can see the job runs. Can you confirm the bucket name and whether anything changed in your IAM policy on Friday?
[Mon 11:02] Customer: Bucket is nw-finance-exports-eu. Our security team rotated the role on Friday and added a condition requiring aws:SecureTransport and a specific source VPC endpoint. They say the policy is correct.
[Mon 11:30] Support (Ana): Our export workers run outside your VPC, so a vpce condition would block the PutObject calls. The manifest is written by a different service that uses your older access key, which is why it still arrives. I have asked engineering to confirm.
[Mon 15:47] Engineering (Raj): Confirmed. PutObject for data files returns AccessDenied (explicit deny on aws:SourceVpce). We do not surface that error in the job status because the manifest step succeeds, which is a bug on our side; ticket ENG-5521.
[Tue 08:05] Customer: Finance missed the reconciliation again this morning. Can you send the export another way today? Also we cannot remove the vpce condition, our auditors require it.
[Tue 08:30] Support (Ana): Options: (1) we can deliver to a bucket in our account and give you a presigned URL for 24 hours, (2) you add our egress IP range as an alternative condition with aws:SourceIp, (3) you set up a PrivateLink connection to our export service, which is in beta for Business plans.
[Tue 10:15] Customer: Option 2 needs security review which takes a week. Option 3 sounds right long term. For today please do option 1. Who do we talk to about PrivateLink pricing?
[Tue 10:40] Support (Ana): Option 1 delivered, link sent to finance@northwind.example. Looping in the account manager for PrivateLink pricing and timeline. ENG-5521 is scheduled for this sprint so failures will show as failed.`;
