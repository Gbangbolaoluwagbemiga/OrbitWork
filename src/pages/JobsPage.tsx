import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useCasper } from "@/contexts/casper-context";
import { useCasperApply } from "@/hooks/use-casper-apply";
import { useToast } from "@/hooks/use-toast";
import { getNextEscrowId, getEscrow, isJobCreationPaused } from "@/lib/casper/casper-contract-service";

import type { Escrow } from "@/lib/web3/types";
import { Briefcase } from "lucide-react";
import { JobsHeader } from "@/components/jobs/jobs-header";
import { JobsStats } from "@/components/jobs/jobs-stats";
import { JobCard } from "@/components/jobs/job-card";
import { ApplicationDialog } from "@/components/jobs/application-dialog";
import { JobsLoading } from "@/components/jobs/jobs-loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function JobsPage() {
  const casper = useCasper();
  const { applyToJob } = useCasperApply();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "active" | "completed" | "disputed"
  >("all");
  const [selectedJob, setSelectedJob] = useState<Escrow | null>(null);
  // const [coverLetter, setCoverLetter] = useState(""); // Unused - handled in dialog
  // const [proposedTimeline, setProposedTimeline] = useState(""); // Unused - handled in dialog
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState<Record<string, boolean>>({});
  const [isContractPaused, setIsContractPaused] = useState(false);
  const [ongoingProjectsCount, setOngoingProjectsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [totalEscrowsCount, setTotalEscrowsCount] = useState(0); // Actual count from blockchain

  const getStatusFromNumber = (
    status: number
  ): "pending" | "disputed" | "active" | "completed" => {
    switch (status) {
      case 0:
        return "pending";
      case 1:
        return "active";
      case 2:
        return "completed";
      case 3:
        return "disputed";
      case 4:
        return "pending"; // Map cancelled to pending
      default:
        return "pending";
    }
  };

  useEffect(() => {
    if (casper.address) {
      fetchOpenJobs();
      countOngoingProjects();
    } else {
    }
    checkContractPauseStatus();
  }, [casper.address]);

  // Removed automatic refresh to prevent constant reloading

  // Check application status when jobs are loaded
  // Don't auto-check application status - fetchOpenJobs already does this
  // This useEffect was causing state to be reset to false
  // useEffect(() => {
  //   if (wallet.address && jobs.length > 0) {
  //     checkApplicationStatus();
  //   }
  // }, [wallet.address, jobs]);

  // Removed duplicate project count refresh

  const checkContractPauseStatus = async () => {
    try {
      const isPaused = await isJobCreationPaused();
      setIsContractPaused(isPaused);
    } catch (error) {
      console.error("Error checking pause status:", error);
      setIsContractPaused(false);
    }
  };

  const countOngoingProjects = async () => {
    try {
      // Use Casper contract service
      const escrowCount = await getNextEscrowId();

      let ongoingCount = 0;

      // Check all escrows to count ongoing projects for this user (both as client and freelancer)
      if (escrowCount > 1) {
        for (let i = 1; i < escrowCount; i++) {
          try {
            const escrow = await getEscrow(i);
            if (!escrow) continue;
            const escrowSummary = [escrow.creator, escrow.freelancer, null, escrow.status];

            const payerAddress = escrowSummary[0]; // depositor/client
            const beneficiaryAddress = escrowSummary[1]; // beneficiary/freelancer
            const userAddress = casper.address;

            // Check if current user is either the payer (client) or beneficiary (freelancer)
            const isPayer =
              payerAddress &&
              userAddress &&
              String(payerAddress).toLowerCase() === String(userAddress).toLowerCase();
            const isBeneficiary =
              beneficiaryAddress &&
              userAddress &&
              String(beneficiaryAddress).toLowerCase() === String(userAddress).toLowerCase();

            // Count projects where user is involved (as client or freelancer)
            if (isPayer || isBeneficiary) {
              const status = Number(escrowSummary[3]); // status is at index 3
              // Count active and pending projects (status 0 = pending, 1 = active)
              // Also count any project that's not completed, disputed, or cancelled
              if (status === 0 || status === 1) {
                ongoingCount++;
              }
            }
          } catch (error) {
            // Skip escrows that don't exist or can't be accessed
            continue;
          }
        }
      }

      setOngoingProjectsCount(ongoingCount);
    } catch (error) {
      setOngoingProjectsCount(0);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      // Check blockchain for application status for each job
      if (!casper.address || jobs.length === 0) return;

      const applicationStatus: Record<string, boolean> = {};

      for (const job of jobs) {
        try {
          // TODO: Implement hasUserApplied for Casper
          // For now, check local state only
          const hasAppliedResult = hasApplied[job.id] || false;
          applicationStatus[job.id] = hasAppliedResult;
          console.log(
            `[checkApplicationStatus] Job ${job.id} hasApplied: ${hasAppliedResult}`
          );
        } catch (error) {
          console.warn(
            `[checkApplicationStatus] Error checking job ${job.id}:`,
            error
          );
          // Preserve existing state if check fails
          applicationStatus[job.id] = hasApplied[job.id] || false;
        }
      }

      setHasApplied((prev) => ({
        ...prev,
        ...applicationStatus, // Merge with existing state instead of replacing
      }));
    } catch (error) {
      console.error("[checkApplicationStatus] Error:", error);
      // Don't reset state on error
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchOpenJobs(), countOngoingProjects()]);
      // Check application status after refreshing jobs
      if (casper.address && jobs.length > 0) {
        await checkApplicationStatus();
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Clear application status cache when wallet changes
  useEffect(() => {
    setHasApplied({});
  }, [casper.address]);

  const fetchOpenJobs = async () => {
    setLoading(true);
    try {
      // Fetch all data from blockchain via Casper contract service
      // This ensures all displayed data is from the Casper blockchain, not mock data

      // For Casper, we use timestamps directly (created_at from contract)
      // No need for ledger sequence conversion

      // Get total number of escrows using Casper contract service
      // NO TIMEOUT - let it complete fully to get accurate count from blockchain
      const escrowCount = await getNextEscrowId();

      // Set the actual escrow count from blockchain
      // escrowCount is the next available ID, so actual count is escrowCount - 1
      const actualCount = Math.max(0, escrowCount - 1);
      setTotalEscrowsCount(actualCount);
      console.log(
        `Total escrows from blockchain: ${actualCount} (next ID: ${escrowCount})`
      );

      const openJobs: Escrow[] = [];

      // Fetch open jobs from the contract
      // escrowCount is the next available ID, so if it's 2, that means 1 escrow exists
      // But if it times out and returns 1, we should still check escrow 1 directly
      // Limit the number of escrows to fetch to prevent long loading times
      const maxEscrowsToFetch = 20; // Limit to 20 escrows max
      const escrowsToCheck = Math.min(
        Math.max(escrowCount - 1, 1),
        maxEscrowsToFetch
      );

      // Always check at least escrow 1, even if escrowCount is 1 (might be timeout default)
      if (escrowsToCheck > 0) {
        for (let i = 1; i <= escrowsToCheck; i++) {
          try {
            const escrowData = await getEscrow(i);
            if (!escrowData) {
              console.log(`[fetchOpenJobs] Escrow ${i} returned null, skipping`);
              continue;
            }

            console.log(`[fetchOpenJobs] Escrow ${i} data:`, {
              creator: escrowData.creator,
              freelancer: escrowData.freelancer,
              is_open_job: escrowData.is_open_job,
              project_title: escrowData.project_title,
              status: escrowData.status,
            });

            // Check if this is an open job (beneficiary is null or zero address, OR is_open_job flag is true)
            // For Casper, null beneficiary means it's an open job
            const zeroAddress =
              "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
            const isOpenJob =
              escrowData.is_open_job === true ||
              !escrowData.freelancer ||
              escrowData.freelancer === zeroAddress ||
              escrowData.freelancer === "";

            console.log(`[fetchOpenJobs] Escrow ${i} isOpenJob check:`, {
              is_open_job_flag: escrowData.is_open_job,
              freelancer: escrowData.freelancer,
              isOpenJob,
            });

            if (isOpenJob) {
              try {
              // Check if current user is the job creator (should not be able to apply to own job)
                // Convert public key hex to AccountHash for comparison
                // Creator from contract is AccountHash (64 hex chars), user address is public key hex (66 chars starting with 01/02)
                let isJobCreator = false;
                if (casper.address && escrowData.creator) {
                  try {
                    // Import PublicKey to convert public key to AccountHash
                    const { PublicKey } = await import("casper-js-sdk");
                    const userPublicKey = PublicKey.fromHex(casper.address);
                    const userAccountHash = userPublicKey.accountHash().toHex().toLowerCase();
                    const creatorHash = escrowData.creator.toLowerCase().trim();
                    isJobCreator = userAccountHash === creatorHash;
                    
                    console.log(`[fetchOpenJobs] Job ${i} creator check:`, {
                      creator: escrowData.creator,
                      creatorHash,
                      userAddress: casper.address,
                      userAccountHash,
                      isJobCreator,
                    });
                  } catch (e) {
                    console.warn(`[fetchOpenJobs] Error comparing addresses for job ${i}:`, e);
                    // Fallback: simple string comparison
                    const normalizedCreator = escrowData.creator.toLowerCase().trim();
                    const normalizedUser = (casper.address || "").toLowerCase().trim();
                    isJobCreator = normalizedCreator === normalizedUser || normalizedCreator.includes(normalizedUser) || normalizedUser.includes(normalizedCreator);
                  }
                }

              // Check if current user has already applied to this job
              // First check local state (preserves state after applying)
              let userHasApplied = hasApplied[i] || false;
              let applicationCount = 0;

              // Check blockchain if not already in local state
              if (!userHasApplied && casper.address) {
                try {
                  const { hasUserApplied: checkHasApplied } = await import("@/lib/casper/casper-contract-service");
                  userHasApplied = await checkHasApplied(i, casper.address);
                  console.log(
                    `User ${casper.address} has applied to job ${i}:`,
                    userHasApplied
                  );
                } catch (e) {
                  console.warn(`[fetchOpenJobs] Error checking if user applied to job ${i}:`, e);
                  userHasApplied = false;
                }
              }

                // For Casper, timestamps might be in seconds or milliseconds
                // Check the magnitude to determine: if > 1e12, it's milliseconds; if < 1e12, it's seconds
                let createdTimestamp: number;
                if (typeof escrowData.created_at === 'bigint') {
                  createdTimestamp = Number(escrowData.created_at);
                } else if (typeof escrowData.created_at === 'number') {
                  createdTimestamp = escrowData.created_at;
                } else {
                  createdTimestamp = Date.now();
                }
                
                // Convert seconds to milliseconds if needed (timestamps < 1e12 are likely seconds)
                if (createdTimestamp > 0 && createdTimestamp < 1e12) {
                  createdTimestamp = createdTimestamp * 1000;
                }
                
                // Validate timestamp is reasonable (not corrupted)
                const now = Date.now();
                if (isNaN(createdTimestamp) || createdTimestamp < 0 || createdTimestamp > now + 86400000 * 365 * 10) {
                  console.warn(`[fetchOpenJobs] Invalid created_at timestamp ${createdTimestamp} for escrow ${i}, using current time`);
                  createdTimestamp = now;
                }
                
                let deadlineTimestamp: number;
                if (typeof escrowData.deadline === 'bigint') {
                  deadlineTimestamp = Number(escrowData.deadline);
                } else if (typeof escrowData.deadline === 'number') {
                  deadlineTimestamp = escrowData.deadline;
                } else {
                  deadlineTimestamp = 0;
                }
                
                // Convert seconds to milliseconds if needed
                if (deadlineTimestamp > 0 && deadlineTimestamp < 1e12) {
                  deadlineTimestamp = deadlineTimestamp * 1000;
                }
                
                // Validate deadline timestamp
                if (isNaN(deadlineTimestamp) || deadlineTimestamp < 0 || deadlineTimestamp < createdTimestamp) {
                  deadlineTimestamp = createdTimestamp + (7 * 24 * 60 * 60 * 1000); // Default to 7 days from creation
                }
                
                const durationInSeconds = deadlineTimestamp > createdTimestamp 
                  ? Math.max(0, deadlineTimestamp - createdTimestamp) / 1000 
                  : 0;
                const durationInDays = Math.ceil(durationInSeconds / (60 * 60 * 24));
                const approxCreatedAt = createdTimestamp;

                // Clean up corrupted project_title (remove non-printable characters)
                let projectTitle = escrowData.project_title || "";
                if (projectTitle && typeof projectTitle === 'string') {
                  // Remove non-printable characters and control characters
                  projectTitle = projectTitle.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
                  if (!projectTitle || projectTitle.length < 2) {
                    projectTitle = `Escrow #${i}`;
                  }
                } else {
                  projectTitle = `Escrow #${i}`;
                }

                // Clean up project_description
                let projectDescription = escrowData.project_description || "";
                if (projectDescription && typeof projectDescription === 'string') {
                  projectDescription = projectDescription.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
                }

                // Handle invalid status - default to "pending" if status is out of range
                let jobStatus: "pending" | "disputed" | "completed" | "active" = "pending";
                try {
                  const statusNum = typeof escrowData.status === 'number' ? escrowData.status : parseInt(String(escrowData.status)) || 0;
                  if (statusNum >= 0 && statusNum <= 4) {
                    jobStatus = getStatusFromNumber(statusNum);
                  } else {
                    console.warn(`[fetchOpenJobs] Invalid status ${statusNum} for escrow ${i}, defaulting to pending`);
                  }
                } catch (e) {
                  console.warn(`[fetchOpenJobs] Error converting status for escrow ${i}:`, e);
                }

                // Convert amount from motes to CSPR (1 CSPR = 1e9 motes)
                // amount is always a string from CasperEscrowData
                let amountStr: string = escrowData.amount || "0";
                
                // Validate amount is reasonable (not corrupted)
                try {
                  const amountNum = BigInt(amountStr);
                  const maxAmount = BigInt("1000000000000000000"); // Max 1 billion CSPR in motes
                  if (amountNum < 0n || amountNum > maxAmount) {
                    console.warn(`[fetchOpenJobs] Suspicious amount ${amountStr} for escrow ${i}, using 0`);
                    amountStr = "0";
                  }
                } catch (e) {
                  console.warn(`[fetchOpenJobs] Invalid amount format ${amountStr} for escrow ${i}, using 0`);
                  amountStr = "0";
                }

              // Convert contract data to our Escrow type
                // All data is from blockchain - fetched via Casper contract service
              const job: Escrow = {
                id: i.toString(),
                  payer: escrowData.creator || "", // depositor/creator (from blockchain)
                beneficiary: escrowData.freelancer || zeroAddress, // beneficiary/freelancer (from blockchain)
                token: escrowData.token || "", // token (from blockchain)
                  totalAmount: amountStr, // totalAmount in motes (from blockchain)
                releasedAmount: "0", // paidAmount - would need to calculate from milestones
                  status: jobStatus, // status (from blockchain, with fallback)
                  createdAt: approxCreatedAt, // Timestamp from Casper blockchain
                  duration: durationInDays, // Duration in days (calculated from timestamps)
                milestones: [], // Would need to fetch milestones separately
                  projectTitle: projectTitle, // projectTitle (cleaned from blockchain)
                  projectDescription: projectDescription, // projectDescription (cleaned from blockchain)
                isOpenJob: true,
                applications: [], // Would need to fetch applications separately
                applicationCount: applicationCount, // Add real application count
                isJobCreator: !!isJobCreator, // Add flag to track if current user is the job creator (from blockchain)
              };

              // Log blockchain data for debugging
              console.log(`Job ${i} from blockchain:`, {
                id: job.id,
                creator: job.payer,
                amount: job.totalAmount,
                status: job.status,
                createdAt: new Date(job.createdAt).toISOString(),
                projectTitle: job.projectTitle,
                isJobCreator: job.isJobCreator,
                  casperAddress: casper.address,
              });

              openJobs.push(job);
                console.log(`[fetchOpenJobs] Successfully added job ${i} to openJobs. Total: ${openJobs.length}`);

              // Store application status from blockchain check
              setHasApplied((prev) => {
                const newState = {
                  ...prev,
                  [job.id]: userHasApplied, // Always use blockchain result
                };
                console.log(
                  `[fetchOpenJobs] Setting hasApplied[${job.id}] = ${userHasApplied}`,
                  newState
                );
                return newState;
              });
              } catch (jobError: any) {
                console.error(`[fetchOpenJobs] Error creating job object for escrow ${i}:`, jobError);
                // Still try to add a minimal job so it shows up
                const minimalJob: Escrow = {
                  id: i.toString(),
                  payer: escrowData.creator || "",
                  beneficiary: escrowData.freelancer || zeroAddress,
                  token: escrowData.token || "",
                  totalAmount: escrowData.amount || "0",
                  releasedAmount: "0",
                  status: "pending",
                  createdAt: Date.now(),
                  duration: 0,
                  milestones: [],
                  projectTitle: `Escrow #${i}`,
                  projectDescription: "Job data partially corrupted but still available",
                  isOpenJob: true,
                  applications: [],
                  applicationCount: 0,
                  isJobCreator: false,
                };
                openJobs.push(minimalJob);
                console.log(`[fetchOpenJobs] Added minimal job ${i} due to error. Total: ${openJobs.length}`);
              }
            }
          } catch (error) {
            // Skip escrows that don't exist or user doesn't have access to
            continue;
          }
        }
      }

      // Set the actual jobs from the blockchain contract
      // All data in openJobs is fetched directly from the blockchain
      console.log(`Loaded ${openJobs.length} jobs from blockchain`);
      setJobs(openJobs);
    } catch (error) {
      toast({
        title: "Failed to load jobs",
        description: "Could not fetch available jobs from the blockchain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (
    job: Escrow,
    coverLetter: string,
    proposedTimeline: string
  ) => {
    const isCasperConnected = casper.isConnected;

    if (!job || !isCasperConnected) {
        toast({ title: "Wallet not connected", description: "Please connect your Casper wallet.", variant: "destructive" });
        return;
    }

    const userAddress = casper.address;

    // Check if user is the job creator (should not be able to apply to own job)
    if (
      job.isJobCreator ||
      (userAddress && job.payer?.toLowerCase() === userAddress.toLowerCase())
    ) {
      toast({
        title: "Cannot Apply",
        description: "You cannot apply to a job you created.",
        variant: "destructive",
      });
      return;
    }

    // Check if freelancer has reached the maximum number of ongoing projects (3)
    if (ongoingProjectsCount >= 3) {
      toast({
        title: "Project Limit Reached",
        description:
          "You can only have a maximum of 3 ongoing projects at a time. Please complete or cancel some projects before applying to new ones.",
        variant: "destructive",
      });
      return;
    }

    // Check if user has already applied to this job (local state)
    if (hasApplied[job.id]) {
      toast({
        title: "Already Applied",
        description: "You have already applied to this job.",
        variant: "destructive",
      });
      return;
    }

    setApplying(true);

    // CASPER PATH
    if (isCasperConnected) {
         try {
             const deployHash = await applyToJob({
                escrowId: Number(job.id),
                coverLetter,
                proposedTimeline: Number(proposedTimeline)
             });
             if (deployHash) {
                 setHasApplied(prev => ({ ...prev, [job.id]: true }));
                 setSelectedJob(null);
                 toast({
                    title: "Application Submitted!",
                    description: "The client will review your application.",
                 });
             }
         } catch(e) {
             console.error(e);
         } finally {
             setApplying(false);
         }
         return;
    }

    // Note: Stellar path removed - using Casper only
  };

  const filteredJobs = jobs.filter((job) => {
    // Search filter
    const matchesSearch =
      job.projectDescription
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      job.milestones.some((m) =>
        m.description.toLowerCase().includes(searchQuery.toLowerCase())
      );

    // Status filter
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (!casper.isConnected || loading) {
    return <JobsLoading isConnected={casper.isConnected} />;
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <JobsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
        <JobsStats
          jobs={jobs}
          openJobsCount={totalEscrowsCount}
          ongoingProjectsCount={ongoingProjectsCount}
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Label htmlFor="status-filter" className="mb-2 block">
              Filter by Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value: any) => setStatusFilter(value)}
            >
              <SelectTrigger id="status-filter" className="w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-6">
          {filteredJobs.length === 0 ? (
            <Card className="glass border-muted p-12 text-center">
              <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                No jobs found matching your search
              </p>
            </Card>
          ) : (
            filteredJobs.map((job, index) => {
              const jobHasApplied = hasApplied[job.id] || false;
              console.log(
                `[JobsPage] Rendering JobCard for job ${job.id}, hasApplied:`,
                jobHasApplied,
                "Full state:",
                hasApplied
              );
              return (
                <JobCard
                  key={job.id}
                  job={job}
                  index={index}
                  hasApplied={jobHasApplied}
                  isContractPaused={isContractPaused}
                  ongoingProjectsCount={ongoingProjectsCount}
                  onApply={setSelectedJob}
                />
              );
            })
          )}
        </div>

        <ApplicationDialog
          job={selectedJob}
          open={!!selectedJob}
          onOpenChange={(open) => !open && setSelectedJob(null)}
          onApply={handleApply}
          applying={applying}
        />
      </div>
    </div>
  );
}
