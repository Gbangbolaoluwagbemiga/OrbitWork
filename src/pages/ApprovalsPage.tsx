import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { useCasper } from "@/contexts/casper-context";
import { useToast } from "@/hooks/use-toast";
import { useJobCreatorStatus } from "@/hooks/use-job-creator-status";
import { usePendingApprovals } from "@/hooks/use-pending-approvals";
import { getNextEscrowId, getEscrow, getApplications } from "@/lib/casper/casper-contract-service";

import {
  useNotifications,
  createApplicationNotification,
} from "@/contexts/notification-context";
import type { Escrow, Application } from "@/lib/web3/types";
import { Briefcase, MessageSquare } from "lucide-react";
import { ApprovalsHeader } from "@/components/approvals/approvals-header";
import { ApprovalsStats } from "@/components/approvals/approvals-stats";
import { JobCard } from "@/components/approvals/job-card";
import { ApprovalsLoading } from "@/components/approvals/approvals-loading";
import { BadgeDisplay, RatingDisplay } from "@/components/rating/badge-display";

interface JobWithApplications extends Escrow {
  applications: Application[];
  applicationCount: number;
  projectDescription?: string;
  isOpenJob?: boolean;
}

const getStatusFromNumber = (
  status: number
): "pending" | "active" | "completed" | "disputed" => {
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

export default function ApprovalsPage() {
  const { address: casperAddress, isConnected: casperIsConnected } = useCasper();
  const { toast } = useToast();
  const { isJobCreator, loading: isJobCreatorLoading } = useJobCreatorStatus();
  const { refreshApprovals } = usePendingApprovals();
  const { addNotification } = useNotifications();
  const [jobs, setJobs] = useState<JobWithApplications[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobWithApplications | null>(
    null
  );
  const [selectedFreelancer, setSelectedFreelancer] =
    useState<Application | null>(null);
  const [selectedJobForApproval, setSelectedJobForApproval] =
    useState<JobWithApplications | null>(null);

  // Debug selectedFreelancer changes
  useEffect(() => {
    if (selectedFreelancer === null) {
      // no-op
    }
  }, [selectedFreelancer]);
  const [approving, setApproving] = useState(false);
  const [, setIsApproving] = useState(false); // Used in handlers



  const fetchMyJobs = useCallback(async () => {
    if (!casperIsConnected || !casperAddress || !isJobCreator) return;

    setLoading(true);
    try {
      // Get next escrow ID from Casper blockchain
      const nextEscrowId = await getNextEscrowId();
      console.log(
        `[ApprovalsPage] next_escrow_id from blockchain: ${nextEscrowId}`
      );

      const myJobs: JobWithApplications[] = [];

      // Check up to 20 escrows (reasonable limit)
      const maxEscrowsToCheck = Math.min(nextEscrowId - 1, 20);
      for (let i = 1; i <= maxEscrowsToCheck; i++) {
        try {
          console.log(`[ApprovalsPage] Checking escrow ${i}...`);
          const escrowData = await getEscrow(i);

          if (!escrowData) {
            console.log(`[ApprovalsPage] Escrow ${i} does not exist`);
            continue;
          }

          // Normalize addresses for comparison
          const normalizeAddress = (addr: string | undefined | null): string => {
            if (!addr) return "";
            return addr.replace(/^(account-hash-|hash-)/, "").toLowerCase().trim();
          };

          const normalizedCreator = normalizeAddress(escrowData.creator);
          const normalizedUser = normalizeAddress(casperAddress);

          // Check if this is my job by comparing AccountHash
          let isMyJob = false;
          try {
            const { PublicKey } = await import("casper-js-sdk");
            const userPublicKey = PublicKey.fromHex(casperAddress);
            const userAccountHash = userPublicKey.accountHash().toHex().toLowerCase();
            isMyJob = normalizedCreator === userAccountHash || normalizedCreator === normalizedUser;
          } catch (e) {
            // Fallback: simple string comparison
            isMyJob = normalizedCreator === normalizedUser;
          }

          console.log(
            `[ApprovalsPage] Escrow ${i} creator: ${escrowData.creator}, normalized: ${normalizedCreator}, user: ${normalizedUser}, isMyJob: ${isMyJob}`
          );

          if (isMyJob) {
            // Check if it's an open job (no freelancer assigned)
            const isOpenJob = escrowData.is_open_job && !escrowData.freelancer;

            console.log(
              `[ApprovalsPage] Escrow ${i} isOpenJob: ${isOpenJob}, freelancer: ${escrowData.freelancer}`
            );

            if (isOpenJob) {
              let applicationCount = 0;
              const applications: Application[] = [];

              // Get applications from Casper blockchain
              try {
                console.log(
                  `[ApprovalsPage] Fetching applications for job ${i}`
                );
                const apps = await getApplications(i);
                console.log(
                  `[ApprovalsPage] Got ${apps.length} applications for job ${i}:`,
                  apps
                );
                applicationCount = apps.length;

                // Convert to Application format
                // Casper timestamps are in milliseconds (u64)
                for (const app of apps) {
                  let appliedAt = Date.now();
                  if (app.applied_at) {
                    // Handle BigInt or number
                    const appliedAtValue = typeof app.applied_at === 'bigint' 
                      ? Number(app.applied_at) 
                      : app.applied_at;
                    // Check if in seconds (less than 1e12) or milliseconds
                    appliedAt = appliedAtValue < 1e12 ? appliedAtValue * 1000 : appliedAtValue;
                  }

                  applications.push({
                    freelancerAddress: app.freelancer || "",
                    coverLetter: app.cover_letter || "",
                    proposedTimeline: app.proposed_timeline || 0,
                    appliedAt,
                    status: "pending" as const,
                    badge: app.badge || "Beginner",
                    averageRating: app.averageRating || 0,
                    ratingCount: app.ratingCount || 0,
                  });
                }

                console.log(
                  `Found ${applicationCount} applications for job ${i}`
                );
              } catch (error) {
                console.error(
                  `Error getting applications for job ${i}:`,
                  error
                );
                applicationCount = 0;
              }

              // Casper timestamps are in milliseconds (u64)
              let createdTimestamp = Date.now();
              if (escrowData.created_at) {
                const createdValue = typeof escrowData.created_at === 'bigint' 
                  ? Number(escrowData.created_at) 
                  : escrowData.created_at;
                createdTimestamp = createdValue < 1e12 ? createdValue * 1000 : createdValue;
              }

              let deadlineTimestamp = createdTimestamp + (7 * 24 * 60 * 60 * 1000); // Default 7 days
              if (escrowData.deadline) {
                const deadlineValue = typeof escrowData.deadline === 'bigint' 
                  ? Number(escrowData.deadline) 
                  : escrowData.deadline;
                deadlineTimestamp = deadlineValue < 1e12 ? deadlineValue * 1000 : deadlineValue;
              }

              const durationInDays = Math.max(
                0,
                (deadlineTimestamp - createdTimestamp) / (24 * 60 * 60 * 1000)
              );

              // Convert amount from motes to CSPR
              let totalAmount = "0";
              if (escrowData.amount) {
                const amountValue = typeof escrowData.amount === 'bigint' 
                  ? escrowData.amount 
                  : BigInt(escrowData.amount);
                const csprAmount = Number(amountValue) / 1e9;
                totalAmount = csprAmount.toString();
              }

              const job: JobWithApplications = {
                id: i.toString(),
                payer: escrowData.creator || "",
                beneficiary: escrowData.freelancer || "",
                token: escrowData.token || "native",
                totalAmount,
                releasedAmount: "0",
                status: getStatusFromNumber(escrowData.status || 0),
                createdAt: createdTimestamp,
                duration: durationInDays,
                milestones: escrowData.milestones || [],
                projectDescription:
                  escrowData.project_title ||
                  escrowData.project_description ||
                  "No description",
                isOpenJob: true,
                applications,
                applicationCount: Number(applicationCount),
              };

              myJobs.push(job);
            }
          }
        } catch (error) {
          console.error(`[ApprovalsPage] Error processing escrow ${i}:`, error);
          continue;
        }
      }

      setJobs(myJobs);
    } catch (error) {
      console.error("[ApprovalsPage] Error fetching jobs:", error);
      toast({
        title: "Failed to load jobs",
        description: "Could not fetch your job postings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [casperIsConnected, casperAddress, isJobCreator]);

  const handleApproveFreelancer = async () => {
    console.log("[handleApproveFreelancer] Called", {
      selectedJobForApproval: selectedJobForApproval?.id,
      selectedFreelancer: selectedFreelancer?.freelancerAddress,
      walletConnected: casperIsConnected,
      walletAddress: casperAddress,
    });

    if (!selectedJobForApproval || !selectedFreelancer || !casperIsConnected) {
      console.error("[handleApproveFreelancer] Missing required data:", {
        selectedJobForApproval: !!selectedJobForApproval,
        selectedFreelancer: !!selectedFreelancer,
        walletConnected: casperIsConnected,
      });
      toast({
        title: "Error",
        description: "Missing required information. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!casperAddress) {
      console.error("[handleApproveFreelancer] Wallet address is missing");
      toast({
        title: "Error",
        description: "Wallet address not found. Please reconnect your wallet.",
        variant: "destructive",
      });
      return;
    }

    setApproving(true);

    try {
      console.log("[handleApproveFreelancer] Starting approval process...");
      console.log(
        "[handleApproveFreelancer] TODO: Implement acceptFreelancer for Casper...",
        {
          escrow_id: Number(selectedJobForApproval!.id),
          freelancer: selectedFreelancer!.freelancerAddress,
          depositor: casperAddress,
        }
      );

      // TODO: Implement acceptFreelancer for Casper
      throw new Error("acceptFreelancer not yet implemented for Casper");

      console.log("[handleApproveFreelancer] Transaction successful!");

      toast({
        title: "Freelancer Approved",
        description: "The freelancer has been approved for this job",
      });

      // Add notification for freelancer approval - notify the FREELANCER
      if (selectedJobForApproval && selectedFreelancer) {
        // TypeScript narrowing: we already checked both are not null
        const jobId = selectedJobForApproval!.id;
        const jobTitle = selectedJobForApproval!.projectDescription || `Job #${jobId}`;
        const freelancerAddr = selectedFreelancer!.freelancerAddress;
        const freelancerName = freelancerAddr.slice(0, 6) + "..." + freelancerAddr.slice(-4);
        
        addNotification(
          createApplicationNotification(
            "approved",
            Number(jobId),
            freelancerAddr,
            {
              jobTitle,
              freelancerName,
            }
          ),
          [freelancerAddr] // Notify the freelancer
        );
      }

      // Close modals first
      setSelectedJob(null);
      setSelectedFreelancer(null);
      setSelectedJobForApproval(null);

      // Wait a moment for the transaction to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Refresh the jobs list
      await fetchMyJobs();

      // Refresh pending approvals status to update navigation
      await refreshApprovals();

      // Force a re-render by updating a dummy state
      setLoading(true);
      setTimeout(() => setLoading(false), 100);
    } catch (error) {
      console.error("[handleApproveFreelancer] Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      toast({
        title: "Approval Failed",
        description: `There was an error approving the freelancer: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  useEffect(() => {
    if (casperIsConnected && isJobCreator) {
      fetchMyJobs();
    }
  }, [casperIsConnected, isJobCreator, fetchMyJobs]);

  // Don't redirect - let client see the page even if no approvals yet
  // They might want to see their jobs

  // Show loading while checking job creator status
  if (isJobCreatorLoading) {
    return <ApprovalsLoading isConnected={casperIsConnected} />;
  }

  if (!casperIsConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your job postings and manage
            applications.
          </p>
        </div>
      </div>
    );
  }

  if (!isJobCreator) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">
            Job Creator Access Required
          </h2>
          <p className="text-muted-foreground">
            You need to be a job creator to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <ApprovalsLoading isConnected={casperIsConnected} />;
  }

  // const totalJobs = jobs.length; // Unused
  // const totalApplications = jobs.reduce(
  //   (sum, job) => sum + job.applicationCount,
  //   0
  // ); // Unused
  // const totalValue = jobs.reduce(
  //   (sum, job) => sum + Number(job.totalAmount) / 1e7,
  //   0
  // ); // Unused

  return (
    <div className="container mx-auto px-4 py-8">
      <ApprovalsHeader />

      {/* Manual Refresh Button */}
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            await fetchMyJobs();
            setLoading(false);
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          🔄 Refresh Jobs
        </button>
      </div>

      <ApprovalsStats jobs={jobs} />

      {jobs.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Job Postings</h3>
          <p className="text-muted-foreground">
            You haven't created any job postings yet.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {jobs.map((job, index) => (
            <JobCard
              key={job.id}
              job={job}
              index={index}
              dialogOpen={selectedJob?.id === job.id}
              selectedJob={selectedJob}
              approving={approving}
              onJobSelect={(job: JobWithApplications) => setSelectedJob(job)}
              onDialogChange={(open: boolean) => {
                if (!open) {
                  setSelectedJob(null);
                  setSelectedFreelancer(null);
                }
              }}
              onApprove={(freelancer: string) => {
                const application = job.applications.find(
                  (app) => app.freelancerAddress === freelancer
                );
                if (application) {
                  setSelectedJobForApproval(job); // Store job data for approval
                  setSelectedJob(null); // Close the first modal
                  setSelectedFreelancer(application);
                  setIsApproving(true);
                } else {
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Application Review Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedJob(null);
              setSelectedFreelancer(null);
            }
          }}
        >
          <div
            className="bg-background rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Review Applications - {selectedJob.projectDescription}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJob(null);
                    setSelectedFreelancer(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {selectedJob.applications.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No applications yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedJob.applications.map((application, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <p className="font-medium">Freelancer Address:</p>
                              <p className="text-sm text-muted-foreground font-mono">
                                {application.freelancerAddress}
                              </p>
                              {application.badge && (
                                <BadgeDisplay badge={application.badge} />
                              )}
                              {(application.averageRating !== undefined ||
                                application.ratingCount !== undefined) && (
                                <RatingDisplay
                                  averageRating={application.averageRating}
                                  ratingCount={application.ratingCount}
                                />
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedJobForApproval(selectedJob); // Store job data for approval
                                setSelectedJob(null); // Close the Application Review Modal
                                setSelectedFreelancer(application);
                                setIsApproving(true);
                              }}
                              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 cursor-pointer"
                            >
                              Approve
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="font-medium">Cover Letter:</p>
                          <p className="text-sm text-muted-foreground">
                            {application.coverLetter}
                          </p>
                        </div>

                        <div>
                          <p className="font-medium">Proposed Timeline:</p>
                          <p className="text-sm text-muted-foreground">
                            {application.proposedTimeline} days
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval/Rejection Confirmation Modal */}
      {(() => {
        return null;
      })()}
      {selectedFreelancer && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedFreelancer(null);
            }
          }}
        >
          {(() => {
            return null;
          })()}
          <div
            className="bg-background rounded-lg max-w-lg w-full border shadow-2xl"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Approve Freelancer</h3>

              <div className="space-y-4">
                <div>
                  <p className="font-medium mb-2">Freelancer Address:</p>
                  <p className="text-sm text-muted-foreground font-mono break-all bg-muted/30 p-3 rounded-md">
                    {selectedFreelancer.freelancerAddress}
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedFreelancer(null)}
                    className="px-4 py-2 border rounded-md hover:bg-muted"
                    disabled={approving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleApproveFreelancer();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                    }}
                    className={`px-4 py-2 rounded-md text-white cursor-pointer bg-green-600 hover:bg-green-700 ${
                      approving ? "opacity-75" : ""
                    }`}
                    disabled={false}
                    style={{
                      pointerEvents: "auto",
                      zIndex: 1000,
                      position: "relative",
                    }}
                  >
                    Confirm Approval
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
